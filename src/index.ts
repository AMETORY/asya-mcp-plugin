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

import { Plugin } from "@opencode/plugin";
import { enroll, type EnrollResponse } from "./enroll.ts";

const ENROLL_CODE_PATTERN = /([A-Z2-9]{8})/;

type McpMetadata = {
  tokenPrefix: string;
  name: string;
  enrolledAt: string;
  organizationId: string;
  serverName: string;
};

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
    // Opsi dari plugin config: url wajib; default sisanya sesuai spec.
    const pluginOptions = ((ctx.options ?? {}) as Record<string, unknown>);
    const url = typeof pluginOptions.url === "string" ? pluginOptions.url : "";
    if (!url) {
      throw new Error("Plugin asya-mcp butuh opsi `url` (URL Supabase functions).");
    }
    const functionsPath =
      (pluginOptions.functionsPath as string | undefined) ?? "/functions/v1/asya-mcp";
    const serverName = (pluginOptions.serverName as string | undefined) ?? "asya-core";
    const mcpUrl = (pluginOptions.mcpUrl as string | undefined) ?? `${url}/mcp`;

    // Metadata non-secret dari sesi sebelumnya (bukan token).
    metadata = ((await ctx.storage.get("asya-mcp")) ?? {}) as McpMetadata;

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

    // /asya-connect & /asya-rotate-token — eksekutor identik: tukar kode
    // enrollasi → credential → MCP reload.
    const enrollCommand = async (prompt: { text?: string }): Promise<string> => {
      const code = ENROLL_CODE_PATTERN.exec(prompt.text ?? "")?.[0];
      if (!code) {
        throw new Error(
          "Kode enrollasi tidak ditemukan (8 karakter [A-Z2-9] di argumen perintah).",
        );
      }
      const result: EnrollResponse = await enroll(code, { url, functionsPath });
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
      return "asya-core token tersedia. Gunakan /asya-status untuk melihat status.";
    };

    ctx.command.transform((editor) => {
      editor.add({
        name: "asya-connect",
        description: "Enroll asya-core MCP token dengan kode enrollasi (8 kar).",
        execute: async (input) => {
          await enrollCommand(input.prompt);
        },
      });
      editor.add({
        name: "asya-rotate-token",
        description: "Rotasi asya-core MCP token dengan kode enrollasi baru.",
        execute: async (input) => {
          await enrollCommand(input.prompt);
        },
      });
      editor.add({
        name: "asya-status",
        description: "Cek metadata enrollment asya-core MCP (tanpa token).",
        execute: async () => {
          console.log("[asya] asya-status:", JSON.stringify(metadata));
        },
      });
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
