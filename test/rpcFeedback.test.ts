import { afterEach, describe, expect, it, vi } from "vitest";

import plugin from "../src/index.ts";

type RpcHandler = (input: unknown) => Promise<Record<string, unknown>>;
type RpcHandlers = {
  connect: RpcHandler;
  rotate: RpcHandler;
  status: RpcHandler;
};

function makeHarness() {
  const storage = new Map<string, unknown>();
  const registration = { dispose: vi.fn() };
  let registered: RpcHandlers | undefined;

  const ctx = {
    options: { url: "https://example.supabase.co/functions/v1" },
    storage: {
      get: vi.fn(async (key: string) => storage.get(key)),
      set: vi.fn(async (key: string, value: unknown) => {
        storage.set(key, value);
      }),
      remove: vi.fn(),
      scan: vi.fn(),
    },
    integration: {
      transform: vi.fn(async (cb: (editor: unknown) => void) => {
        cb({
          update: vi.fn(),
          remove: vi.fn(),
          method: { update: vi.fn(), remove: vi.fn() },
        });
        return registration;
      }),
      connect: { key: vi.fn().mockResolvedValue(undefined) },
      connection: {
        active: vi.fn().mockResolvedValue(undefined),
        resolve: vi.fn().mockResolvedValue(undefined),
      },
    },
    mcp: {
      transform: vi.fn(async (cb: (editor: unknown) => void) => {
        cb({ get: vi.fn().mockReturnValue(undefined), set: vi.fn(), update: vi.fn(), remove: vi.fn() });
        return registration;
      }),
      reload: vi.fn().mockResolvedValue(undefined),
    },
    tool: {
      transform: vi.fn(async (cb: (editor: unknown) => void) => {
        cb({ add: vi.fn(), namespace: vi.fn(), update: vi.fn(), remove: vi.fn() });
        return registration;
      }),
      reload: vi.fn().mockResolvedValue(undefined),
    },
    // Tidak ada `command` maupun `session`: enroll kini lewat RPC, bukan
    // perintah server yang mengirim pesan synthetic ke chat.
    rpc: {
      register: vi.fn(async (_def: unknown, handlers: RpcHandlers) => {
        registered = handlers;
        return { dispose: vi.fn() };
      }),
    },
  };

  return { ctx, storage, handlers: () => registered };
}

function enrollResponse(token: string) {
  return new Response(
    JSON.stringify({
      token,
      name: "token uji",
      token_type: "mcp",
      feature_keys: ["general_ledger"],
      expires_at: null,
      organization_id: "org-123",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function stubEnrollSuccess() {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(enrollResponse("asya_mcp_SECRETVALUE"));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const metadataShape = {
  name: "token uji",
  organizationId: "org-123",
  tokenPrefix: expect.any(String),
  enrolledAt: expect.any(String),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handler RPC asya-core", () => {
  it("connect mengembalikan metadata tanpa token maupun kode", async () => {
    const h = makeHarness();
    stubEnrollSuccess();
    await plugin.setup(h.ctx as never);

    const result = await h.handlers()!.connect({ code: "ABCDEFG2" });

    expect(result).toEqual(metadataShape);
    expect(result).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("code");
  });

  it("connect menyimpan kredensial lewat integrasi lalu memuat ulang MCP", async () => {
    const h = makeHarness();
    stubEnrollSuccess();
    await plugin.setup(h.ctx as never);
    vi.mocked(h.ctx.mcp.reload).mockClear();

    await h.handlers()!.connect({ code: "ABCDEFG2" });

    expect(h.ctx.integration.connect.key).toHaveBeenCalledWith({
      integrationID: "asya-core",
      key: "asya_mcp_SECRETVALUE",
    });
    expect(h.ctx.mcp.reload).toHaveBeenCalledTimes(1);
  });

  it("rotate mengembalikan metadata yang sama dengan connect", async () => {
    const h = makeHarness();
    stubEnrollSuccess();
    await plugin.setup(h.ctx as never);

    const result = await h.handlers()!.rotate({ code: "ABCDEFG2" });

    expect(result).toEqual(metadataShape);
    expect(result).not.toHaveProperty("token");
  });

  it("status sebelum enroll connected:false, setelah enroll connected:true", async () => {
    const h = makeHarness();
    stubEnrollSuccess();
    await plugin.setup(h.ctx as never);

    expect(await h.handlers()!.status({})).toEqual({ connected: false });

    await h.handlers()!.connect({ code: "ABCDEFG2" });

    expect(await h.handlers()!.status({})).toEqual({
      connected: true,
      ...metadataShape,
      tokenPrefix: "asya_mcp",
    });
  });

  it("enroll HTTP 400 melempar error yang tidak membocorkan token", async () => {
    const h = makeHarness();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Kode tidak valid" } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await plugin.setup(h.ctx as never);

    const failed = h.handlers()!.connect({ code: "ABCDEFG2" });
    await expect(failed).rejects.toThrow("Enroll gagal: Kode tidak valid");
    let message = "";
    try {
      await failed;
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain("asya_mcp_SECRETVALUE");
  });

  it("kode enrollasi salah ditolak sebelum fetch dipanggil", async () => {
    const h = makeHarness();
    const fetchMock = stubEnrollSuccess();
    await plugin.setup(h.ctx as never);
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(h.handlers()!.connect({ code: "salah" })).rejects.toThrow(
      "Kode enrollasi tidak ditemukan",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("status mengisi organizationName dari tool MCP untuk metadata lama", async () => {
    const h = makeHarness();
    h.storage.set("asya-mcp", {
      name: "token uji",
      organizationId: "org-123",
      enrolledAt: "2026-11-23T00:00:00.000Z",
      tokenPrefix: "asya_mcp",
      serverName: "asya-core",
    });
    vi.mocked(h.ctx.integration.connection.active).mockResolvedValue({
      integrationID: "asya-core",
    } as never);
    vi.mocked(h.ctx.integration.connection.resolve).mockResolvedValue({
      key: "asya_mcp_SECRETVALUE",
    });
    const payload = '{"organization_id":"org-123","name":"Demo Company"}';
    const sse = `event: message\ndata: {"result":{"content":[{"type":"text","text":"${payload.replace(/"/g, '\\"')}"}]}}\n\n`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(sse, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );
    await plugin.setup(h.ctx as never);

    const result = await h.handlers()!.status({});

    expect(result.organizationName).toBe("Demo Company");
    expect(result.organizationId).toBe("org-123");
    expect(JSON.stringify(h.storage.get("asya-mcp"))).not.toContain("SECRETVALUE");
  });

  it("status fallback ke UUID saat resolver gagal", async () => {
    const h = makeHarness();
    h.storage.set("asya-mcp", {
      name: "token uji",
      organizationId: "org-123",
      enrolledAt: "2026-11-23T00:00:00.000Z",
      tokenPrefix: "asya_mcp",
      serverName: "asya-core",
    });
    vi.mocked(h.ctx.integration.connection.active).mockResolvedValue({
      integrationID: "asya-core",
    } as never);
    vi.mocked(h.ctx.integration.connection.resolve).mockResolvedValue({
      key: "asya_mcp_SECRETVALUE",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("jaringan mati")));
    await plugin.setup(h.ctx as never);

    const result = await h.handlers()!.status({});

    expect(result.connected).toBe(true);
    expect(result.organizationName).toBeUndefined();
    expect(result.organizationId).toBe("org-123");
  });

  it("status tetap connected bila cache storage gagal ditulis", async () => {
    const h = makeHarness();
    h.storage.set("asya-mcp", {
      name: "token uji",
      organizationId: "org-123",
      enrolledAt: "2026-11-23T00:00:00.000Z",
      tokenPrefix: "asya_mcp",
      serverName: "asya-core",
    });
    vi.mocked(h.ctx.integration.connection.active).mockResolvedValue({
      integrationID: "asya-core",
    } as never);
    vi.mocked(h.ctx.integration.connection.resolve).mockResolvedValue({
      key: "asya_mcp_SECRETVALUE",
    });
    const payload = '{"organization_id":"org-123","name":"Demo Company"}';
    const sse = `data: {"result":{"content":[{"type":"text","text":"${payload.replace(/"/g, '\\"')}"}]}}\n\n`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(sse, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );
    vi.mocked(h.ctx.storage.set).mockRejectedValueOnce(new Error("disk penuh"));
    await plugin.setup(h.ctx as never);

    const result = await h.handlers()!.status({});

    expect(result.connected).toBe(true);
    expect(result.organizationName).toBe("Demo Company");
  });
});
