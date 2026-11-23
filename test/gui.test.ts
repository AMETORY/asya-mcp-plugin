import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("plugin GUI asya-core", () => {
  const gui = () => read("src/gui.ts");

  it("paket mengekspor bundle CommonJS ./gui-experimental", () => {
    const pkg = JSON.parse(read("package.json"));
    const target = pkg.exports["./gui-experimental"];
    // Resolver Desktop hanya menerima path yang cocok /\.c?js$/; sumber .ts ditolak.
    expect(target).toMatch(/\.c?js$/);
    expect(target).toBe("./prebuilt/gui.cjs");
    const bundle = read(target);
    expect(bundle).toContain("module.exports");
    expect(bundle).toContain('require("@opencode/plugin/gui")');
    expect(bundle).toContain('require("@opencode/plugin/rpc")');
    for (const name of ["asya-connect", "asya-rotate-token", "asya-status"]) {
      expect(bundle).toContain(`slash: { name: "${name}" }`);
    }
  });

  it("bundle bisa dimuat require-shim Desktop yang hanya menyediakan modul bersama", () => {
    const pkg = JSON.parse(read("package.json"));
    const code = read(pkg.exports["./gui-experimental"]);
    const Command = { __kind: "Command" };
    const shared: Record<string, unknown> = {
      "@opencode/plugin/gui": {
        Plugin: { define: (value: unknown) => value },
        Command,
      },
      "@opencode/plugin/rpc": { Rpc: { define: (value: unknown) => value } },
    };
    const requested: string[] = [];
    const mod = { exports: {} as Record<string, any> };

    Function("require", "module", "exports", code)(
      (id: string) => {
        requested.push(id);
        if (id in shared) return shared[id];
        throw new Error(`modul tidak dibagikan: ${id}`);
      },
      mod,
      mod.exports,
    );

    expect(requested).toEqual(["@opencode/plugin/gui", "@opencode/plugin/rpc"]);
    const plugin = mod.exports.default;
    expect(typeof plugin.setup).toBe("function");
    const names: string[] = [];
    plugin.setup({
      add: (kind: unknown, cmd: { slash: { name: string } }) => {
        if (kind === Command) names.push(cmd.slash.name);
      },
      dialogs: {},
      client: {},
      toast: {},
    });
    expect(names).toEqual(["asya-connect", "asya-rotate-token", "asya-status"]);
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
