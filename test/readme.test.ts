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

  it("jujur soal endpoint /mcp dan aturan token", () => {
    expect(readme).toMatch(/404/);
    expect(readme).toMatch(/token/i);
    expect(readme).toMatch(/tidak ditaruh/i);
  });
});
