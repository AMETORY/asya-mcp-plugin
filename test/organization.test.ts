import { afterEach, describe, expect, it, vi } from "vitest";

const TOKEN = "asya_mcp_SECRETVALUE";
const ORG_PAYLOAD =
  '{"organization_id":"org-1","name":"Demo Company"}';
const JSON_OK =
  '{"result":{"content":[{"type":"text","text":"' +
  ORG_PAYLOAD.replace(/"/g, '\\"') +
  '"}]},"jsonrpc":"2.0","id":2}';
const SSE_OK = `data: ${JSON_OK}\n\n`;
const SSE_EMPTY_NAME =
  'data: {"result":{"content":[{"type":"text","text":"' +
  '{"organization_id":"org-1","name":""}'.replace(/"/g, '\\"') +
  '"}]}}\n\n';

function sseResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/event-stream" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveOrganizationName", () => {
  it("mengembalikan nama dari payload SSE tool MCP", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(SSE_OK));
    vi.stubGlobal("fetch", fetchMock);
    const { resolveOrganizationName } = await import("../src/organization.ts");

    const result = await resolveOrganizationName(
      "https://example.supabase.co/functions/v1/asya-mcp/mcp",
      TOKEN,
    );

    expect(result).toBe("Demo Company");
    expect(result).not.toContain(TOKEN);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/functions/v1/asya-mcp/mcp");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers.Accept).toContain("text/event-stream");
    expect(JSON.parse(init.body as string)).toEqual({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "asya_get_active_organization", arguments: {} },
    });
  });

  it("membaca baris data kedua bila SSE diawali event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse(
          `event: message\n${SSE_OK}data: {"jsonrpc":"2.0","id":3,"result":null}\n\n`,
        ),
      ),
    );
    const { resolveOrganizationName } = await import("../src/organization.ts");

    expect(
      await resolveOrganizationName("https://example.test/mcp", TOKEN),
    ).toBe("Demo Company");
  });

  it("mengembalikan null pada HTTP 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse("upstream error", 500)),
    );
    const { resolveOrganizationName } = await import("../src/organization.ts");

    expect(await resolveOrganizationName("https://example.test/mcp", TOKEN)).toBeNull();
  });

  it("mengembalikan null saat fetch menolak", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("jaringan mati")));
    const { resolveOrganizationName } = await import("../src/organization.ts");

    expect(await resolveOrganizationName("https://example.test/mcp", TOKEN)).toBeNull();
  });

  it("mengabaikan baris data dengan JSON rusak lalu membaca baris valid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse(`data: not-json\n${SSE_OK}`)),
    );
    const { resolveOrganizationName } = await import("../src/organization.ts");

    expect(await resolveOrganizationName("https://example.test/mcp", TOKEN)).toBe(
      "Demo Company",
    );
  });

  it("mengembalikan null pada HTTP 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse("unauthorized", 401)),
    );
    const { resolveOrganizationName } = await import("../src/organization.ts");

    expect(await resolveOrganizationName("https://example.test/mcp", TOKEN)).toBeNull();
  });

  it("mengembalikan null untuk nama organisasi kosong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse(SSE_EMPTY_NAME)),
    );
    const { resolveOrganizationName } = await import("../src/organization.ts");

    expect(await resolveOrganizationName("https://example.test/mcp", TOKEN)).toBeNull();
  });

  it("membaca payload JSON-RPC polos tanpa pembungkus SSE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON_OK, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const { resolveOrganizationName } = await import("../src/organization.ts");

    expect(await resolveOrganizationName("https://example.test/mcp", TOKEN)).toBe(
      "Demo Company",
    );
  });
});
