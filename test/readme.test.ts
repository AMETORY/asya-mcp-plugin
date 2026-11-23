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
});
