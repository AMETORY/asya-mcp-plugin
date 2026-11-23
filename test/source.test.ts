import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("package.json", () => {
  it("nama, dependency, dan exports sesuai desain", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.name).toBe("opencode-asya-mcp");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies["@opencode/plugin"]).toBeDefined();
    expect(pkg.exports["."]).toBe("./src/index.ts");
  });
});

describe("sumber plugin", () => {
  const src = read("src/index.ts");
  const enrollSrc = read("src/enroll.ts");

  it("url wajib", () => {
    expect(src).toContain("Plugin asya-mcp butuh opsi `url`");
  });

  it("validasi kode enroll sebelum fetch", () => {
    expect(src).toContain("ENROLL_CODE_PATTERN.exec");
    expect(src).toContain("Kode enrollasi tidak ditemukan");
    expect(enrollSrc).toContain("^[A-Z2-9]{8}$");
  });

  it("token tidak masuk storage atau log", () => {
    expect(src).not.toMatch(/console\.log\([^)]*token/);
    expect(src).toContain("ctx.integration.connect.key");
    const m = src.match(/ctx\.storage\.set\(\s*['"]asya-mcp['"],\s*\{([\s\S]*?)\}\s*\)/);
    expect(m).not.toBeNull();
    if (m) {
      expect(m[1]).not.toMatch(/\btoken\s*:/);
      expect(m[1]).not.toContain("enrollmentCode");
      expect(m[1]).toContain("tokenPrefix");
    }
  });

  it("enroll memakai POST /enroll", () => {
    expect(enrollSrc).toContain("/enroll");
    expect(enrollSrc).toContain("JSON.stringify({ code");
  });
});
