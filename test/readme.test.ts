import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");

describe("README instalasi", () => {
  it("alamat repo publik, bukan path relatif", () => {
    expect(readme).toContain("github:AMETORY/asya-mcp-plugin");
    expect(readme).not.toContain("./plugins/opencode-asya-mcp");
  });

  it("contoh config memuat options.url wajib", () => {
    expect(readme).toContain("opencode.jsonc");
    expect(readme).toContain("options");
    expect(readme).toContain('"url"');
  });

  it("mendokumentasikan perintah dan tool", () => {
    for (const name of ["/asya-connect", "/asya-rotate-token", "/asya-status", "asya_status"]) {
      expect(readme).toContain(name);
    }
  });

  it("perintah enroll memakai dialog, bukan argumen chat", () => {
    expect(readme).toMatch(/dialog/i);
    expect(readme).toMatch(/kode enrollasi/i);
  });

  it("contoh config memuat server produksi ASYA", () => {
    const url = "https://robrebioyfquemukodze.supabase.co/functions/v1";
    expect(readme).toContain(`"url": "${url}"`);
    expect(readme.split(url).length - 1).toBeGreaterThanOrEqual(2);
  });

  it("jujur soal HTTP 404 enroll dan aturan token", () => {
    expect(readme).toMatch(/404/);
    expect(readme).toMatch(/token/i);
    expect(readme).toMatch(/tidak ditaruh/i);
  });

  it("default functionsPath tidak menggandakan /functions/v1", () => {
    expect(readme).toContain("| `functionsPath` | `/asya-mcp` |");
    expect(readme).not.toContain(
      "| `functionsPath` | `/functions/v1/asya-mcp` |",
    );
    expect(readme).toContain("`<url>/asya-mcp/mcp`");
  });

  it("troubleshooting menyebut 404 enroll", () => {
    expect(readme).toMatch(/Enroll gagal: HTTP 404/);
  });

  it("mendokumentasikan batasan TUI terminal vs Desktop", () => {
    expect(readme).toContain("Terminal vs Desktop");
    expect(readme).toContain("./gui-experimental");
    expect(readme).toContain("tanpa `--standalone`");
    expect(readme).toMatch(/OpenCode Desktop/);
  });

  it("mendokumentasikan opencode mcp add memakai env var", () => {
    expect(readme).toContain("opencode mcp add asya-core");
    expect(readme).toContain("{env:ASYA_MCP_TOKEN}");
    expect(readme).toContain('"oauth": false');
    expect(readme).toContain("opencode mcp list");
  });

  it("mendokumentasikan dukungan slash command di Desktop", () => {
    expect(readme).toContain("Terminal vs Desktop");
    expect(readme).toMatch(/Desktop.{0,80}slash command/s);
    expect(readme).not.toContain("tidak akan muncul di Desktop");
    expect(readme).toContain("./gui-experimental");
  });

  it("memuat panduan agen lain dengan placeholder token", () => {
    expect(readme).toContain("claude mcp add --transport http asya-core");
    expect(readme).toContain("[mcp_servers.asya-core]");
    expect(readme).toContain("bearer_token_env_var");
    expect(readme).toContain('"mcpServers"');
    expect(readme).toContain("<TOKEN>");
  });

  it("mendokumentasikan alur OAuth browser sebagai opsi setelah rollout", () => {
    expect(readme).toMatch(/Opsi OAuth lewat browser/i);
    expect(readme).toContain(
      "--url https://robrebioyfquemukodze.supabase.co/functions/v1/asya-mcp/mcp",
    );
    expect(readme).toContain("resource_metadata");
    expect(readme).toContain("ASYA_OAUTH_SIGNING_KEY");
    expect(readme).toContain("ASYA_OAUTH_COOKIE_KEY");
    expect(readme).toContain("<issuer>/return/otp");
    expect(readme).toContain("organization_id");
  });

  it("tidak mengandung token atau kode enrollasi nyata", () => {
    expect(readme).not.toMatch(/asya_mcp[A-Za-z0-9_-]{12,}/);
    expect(readme).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{20,}/);
    expect(readme).not.toMatch(/(?<![A-Za-z0-9\[-])[A-Z2-9]{8}(?![A-Za-z0-9\]-])/);
  });
});
