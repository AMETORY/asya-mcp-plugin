import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("plugin GUI asya-core", () => {
  const gui = () => read("src/gui.ts");

  it("paket mengekspor ./gui-experimental", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.exports["./gui-experimental"]).toBe("./src/gui.ts");
  });

  it("mendaftarkan tiga slash command dengan nama yang sama dengan TUI", () => {
    const tui = read("src/tui.ts");
    for (const name of ["asya-connect", "asya-rotate-token", "asya-status"]) {
      expect(gui()).toContain(`slash: { name: "${name}" }`);
      expect(tui).toContain(`slash: { name: "${name}" }`);
    }
    expect(gui()).toContain("ctx.add(Command");
  });

  it("kode diminta lewat prompt rahasia dan divalidasi sebelum RPC", () => {
    const src = gui();
    expect(src).toContain("ctx.dialogs.prompt(");
    expect(src).toContain("secret: true");
    expect(src).toContain("isValidEnrollCode(");
    expect(src).not.toContain("arguments: true");
    expect(src).not.toContain("slash.arguments");
  });

  it("membatalkan dialog atau kode salah tidak memanggil RPC", () => {
    const src = gui();
    expect(src).toContain("if (!code) return;");
    expect(src).toContain("if (!isValidEnrollCode(code))");
  });

  it("klien RPC dibaca per command dan toast memakai konvensi GUI", () => {
    const src = gui();
    expect(src.split("ctx.client.rpc(Asya)").length - 1).toBe(3);
    expect(src).toContain("description:");
    expect(src).toContain('variant: "default"');
    expect(src).not.toContain("message:");
    expect(src).not.toContain('variant: "info"');
  });

  it("GUI tidak menyimpan atau mengirim kredensial sendiri", () => {
    const src = gui();
    expect(src).not.toContain("console.log");
    expect(src).not.toContain("fetch(");
    expect(src).not.toContain("ctx.storage");
    expect(src).not.toContain("ctx.integration");
    expect(src).not.toMatch(/asya_mcp[A-Za-z0-9_-]{12,}/);
    expect(src).not.toMatch(/(?<![A-Za-z0-9\[-])[A-Z2-9]{8}(?![A-Za-z0-9\]-])/);
  });
});
