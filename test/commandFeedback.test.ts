import { afterEach, describe, expect, it, vi } from "vitest";

import plugin from "../src/index.ts";

type CommandDef = {
  name: string;
  execute: (input: {
    sessionID: string;
    prompt: { text?: string };
    delivery: "steer" | "queue";
  }) => Promise<void>;
};

function makeHarness() {
  const commands = new Map<string, CommandDef>();
  const synthetic = vi.fn().mockResolvedValue({});
  const storage = new Map<string, unknown>();
  const registration = { dispose: vi.fn() };

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
        cb({ set: vi.fn(), update: vi.fn(), remove: vi.fn() });
        return registration;
      }),
      reload: vi.fn().mockResolvedValue(undefined),
    },
    command: {
      transform: vi.fn(async (cb: (editor: unknown) => void) => {
        cb({ add: (def: CommandDef) => commands.set(def.name, def) });
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
    session: { synthetic },
  };

  return { ctx, commands, synthetic, storage };
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

async function runCommand(
  h: ReturnType<typeof makeHarness>,
  name: string,
  text: string,
) {
  await plugin.setup(h.ctx as never);
  await h.commands.get(name)!.execute({
    sessionID: "ses-test",
    prompt: { text },
    delivery: "steer",
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("umpan balik perintah asya-core", () => {
  it("/asya-connect menampilkan pesan sukses tanpa token maupun kode", async () => {
    const h = makeHarness();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(enrollResponse("asya_mcp_SECRETVALUE")));

    await runCommand(h, "asya-connect", "ABCDEFG2");

    expect(h.synthetic).toHaveBeenCalledWith({
      sessionID: "ses-test",
      text: expect.stringContaining("asya-core tersambung"),
    });
    const text = h.synthetic.mock.calls[0][0].text as string;
    expect(text).toContain("token uji");
    expect(text).not.toContain("asya_mcp_SECRETVALUE");
    expect(text).not.toContain("ABCDEFG2");
  });

  it("/asya-rotate-token menampilkan pesan sukses", async () => {
    const h = makeHarness();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(enrollResponse("asya_mcp_SECRETVALUE")));

    await runCommand(h, "asya-rotate-token", "ABCDEFG2");

    expect(h.synthetic).toHaveBeenCalledWith({
      sessionID: "ses-test",
      text: expect.stringContaining("asya-core tersambung"),
    });
  });

  it("/asya-status menampilkan metadata tanpa token", async () => {
    const h = makeHarness();
    h.storage.set("asya-mcp", {
      tokenPrefix: "asya_mcp",
      name: "token lama",
      enrolledAt: "2026-01-01T00:00:00.000Z",
      organizationId: "org-123",
      serverName: "asya-core",
    });

    await runCommand(h, "asya-status", "");

    expect(h.synthetic).toHaveBeenCalledWith({
      sessionID: "ses-test",
      text: expect.stringContaining("org-123"),
    });
    const text = h.synthetic.mock.calls[0][0].text as string;
    expect(text).toContain("token lama");
    expect(text).not.toMatch(/asya_mcp_[A-Za-z0-9]{6,}/);
  });

  it("/asya-connect menampilkan pesan error saat enroll gagal", async () => {
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

    await expect(runCommand(h, "asya-connect", "ABCDEFG2")).resolves.toBeUndefined();

    expect(h.synthetic).toHaveBeenCalledWith({
      sessionID: "ses-test",
      text: expect.stringContaining("Gagal menghubungkan asya-core"),
    });
    expect(h.synthetic.mock.calls[0][0].text).toContain("Kode tidak valid");
  });
});
