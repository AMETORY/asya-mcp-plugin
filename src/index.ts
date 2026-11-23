// OpenCode plugin ASYA MCP — enrollment via one-time code + credential storage.
//
// Arsitektur (per spec 2026-11-22-organization-api-token):
// - Plain token ditukar lewat kode enrollasi sekali pakai; hanya muncul sekali.
// - Credential disimpan lewat ctx.integration.connect.key (integration asya-core),
//   OpenCode mengirimkan header Authorization saat menghubungkan MCP server.
// - ctx.storage hanya menyimpan METADATA non-secret (prefix, nama, tanggal,
//   ID organisasi, serverName). Tidak pernah token atau enrollment code.
// - Token hanya dalam memori in-memory; server asya-core menerima Authorization
//   lewat header MCP (oauth: false).
// - Enroll diekspos lewat RPC `asya` (connect/rotate/status). Slash command
//   dengan nama sama disediakan TUI, bukan plugin server — hindari duplikasi.

import { Plugin } from "@opencode/plugin";
import { enroll, extractEnrollCode, type EnrollResponse } from "./enroll.ts";
import { resolveOptions } from "./options.ts";
import { Asya, type AsyaMetadata } from "./rpc.ts";

type McpMetadata = AsyaMetadata & { serverName: string };

// Token dalam memori. Tidak ditulis ke ctx.storage, tool output, atau log.
let token: string | null = null;
let metadata: McpMetadata | undefined;

// Defensive credential extract — untuk response OpenCode yang bentuknya
// bisa { key: string }, { value: string }, { token: string }, atau plain string.
function extractToken(credential: unknown): string | null {
  if (typeof credential === "string" && credential.trim()) {
    return credential.trim();
  }
  if (credential && typeof credential === "object") {
    const record = credential as Record<string, unknown>;
    for (const key of ["key", "value", "token", "accessToken", "access", "credential"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  return null;
}

export default Plugin.define({
  id: "asya-mcp",
  async setup(ctx) {
    // Opsi dari plugin config: `url` wajib; default lain di resolveOptions.
    const { url, functionsPath, serverName, mcpUrl } = resolveOptions(ctx.options);

    // Metadata non-secret dari sesi sebelumnya (bukan token). Objek kosong
    // dari storage dianggap "belum enroll" agar status tidak misleading.
    const stored = (await ctx.storage.get("asya-mcp")) as McpMetadata | undefined;
    metadata = stored && Object.keys(stored).length > 0 ? stored : undefined;

    // Daftarkan integration `asya-core` dengan method `key` —
    // OpenCode replay transform saat startup.
    // Residual runtime uncertainty (findings round 1): IntegrationEditor is
    // documented with `update(id, callback)`; the `add` method isn't listed.
    // Register the integration per spec line 158 via the documented API —
    // do not invent `add` or store the token in ctx.storage as a fallback.
    ctx.integration.transform((editor) => {
      editor.update("asya-core", (integration) => {
        integration.name = "ASYA Core";
      });
      editor.method.update({
        integrationID: "asya-core",
        method: { type: "key" },
      });
    });

    const applyMcp = async (): Promise<void> => {
      await ctx.mcp.transform((editor) => {
        if (!token) return;
        editor.set(serverName, {
          type: "remote",
          url: mcpUrl,
          oauth: false,
          headers: { Authorization: `Bearer ${token}` },
        });
      });
      await ctx.mcp.reload();
    };

    // Eksekutor RPC `connect` dan `rotate` identik: tukar kode enrollasi →
    // credential → MCP reload. Kembalikan HANYA metadata non-secret.
    const enrollCommand = async (code: string): Promise<AsyaMetadata> => {
      const extracted = extractEnrollCode(code);
      if (!extracted) {
        throw new Error("Kode enrollasi tidak ditemukan (8 karakter [A-Z2-9]).");
      }
      const result: EnrollResponse = await enroll(extracted, { url, functionsPath });
      // Simpan plain token lewat ctx.integration.connect.key — bukan ke
      // skill, source, atau opencode.jsonc.
      await ctx.integration.connect.key({ integrationID: 'asya-core', key: result.token });

      token = result.token;
      metadata = {
        tokenPrefix: result.token.slice(0, 8),
        name: result.name,
        enrolledAt: new Date().toISOString(),
        organizationId: result.organization_id,
        serverName,
      };
      // Metadata-only ke ctx.storage — tanpa `token`, tanpa `enrollmentCode`.
      await ctx.storage.set("asya-mcp", {
        tokenPrefix: metadata.tokenPrefix,
        name: metadata.name,
        enrolledAt: metadata.enrolledAt,
        organizationId: metadata.organizationId,
        serverName: metadata.serverName,
      });
      await applyMcp();
      const { name, organizationId, enrolledAt, tokenPrefix } = metadata;
      return { name, organizationId, enrolledAt, tokenPrefix };
    };

    // Satu-satunya permukaan enroll: RPC untuk TUI. Perintah server dan pesan
    // synthetic dihapus — TUI yang menampilkan umpan balik slash command,
    // plugin hanya mengembalikan metadata.
    await ctx.rpc.register(Asya, {
      connect: async (input) => enrollCommand((input as { code: string }).code),
      rotate: async (input) => enrollCommand((input as { code: string }).code),
      status: async () => metadata
        ? { connected: true, name: metadata.name, organizationId: metadata.organizationId,
            enrolledAt: metadata.enrolledAt, tokenPrefix: metadata.tokenPrefix }
        : { connected: false },
    });

    ctx.tool.transform((editor) => {
      editor.add({
        name: "asya_status",
        description: "Cek status enrollment asya-core MCP (metadata tanpa token).",
        input: { type: "object", properties: {} },
        execute: async () => ({ content: JSON.stringify(metadata) }),
      });
    });

    // Resolve credential tersimpan saat startup agar transform replay dari
    // ctx.mcp.transform bisa memasukkan token ke header MCP.
    const connection = await ctx.integration.connection.active('asya-core');
    if (connection) {
      const credential = await ctx.integration.connection.resolve(connection);
      const resolved = extractToken(credential);
      if (resolved) {
        token = resolved;
      }
    }

    await applyMcp();
  },
});
