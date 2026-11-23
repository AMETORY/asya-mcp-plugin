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
    expect(pkg.exports["./tui"]).toBe("./src/tui.ts");
    expect(pkg.exports["./rpc"]).toBe("./src/rpc.ts");
  });
});

describe("sumber plugin", () => {
  const src = read("src/index.ts");
  const enrollSrc = read("src/enroll.ts");

  it("url wajib divalidasi oleh resolver opsi", () => {
    expect(read("src/options.ts")).toContain("Plugin asya-mcp butuh opsi `url`");
  });

  it("validasi kode enroll sebelum fetch", () => {
    expect(src).toContain("extractEnrollCode(");
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

  it("perintah enroll hanya lewat RPC, bukan perintah chat", () => {
    expect(src).not.toContain("ctx.command.transform");
    expect(src).not.toContain("synthetic(");
    expect(src).toContain("ctx.rpc.register(Asya");
  });

  it("tidak menimpa entri MCP existing dari opencode mcp add / OAuth", () => {
    expect(src).toContain("mcpManagedByPlugin");
    expect(src).toContain("editor.get(serverName)");
    expect(src).toContain("if (existing && !mcpManagedByPlugin) return;");
    expect(src).toContain("mcpManagedByPlugin = true;");
  });

  it("RPC tidak mengembalikan token", () => {
    expect(read("src/rpc.ts")).not.toContain("token:");
  });

  it("TUI meminta kode lewat dialog tanpa menyimpan atau mencatatnya", () => {
    const tui = read("src/tui.ts");
    expect(tui).toContain("dialog.prompt");
    expect(tui).toContain("context.client.rpc(Asya)");
    expect(tui).toContain("isValidEnrollCode(");
    expect(tui).not.toContain("console.log");
    expect(tui).not.toContain("integration.connect.key");
  });
});
