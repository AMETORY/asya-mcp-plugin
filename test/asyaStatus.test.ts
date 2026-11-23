import { describe, expect, it, vi } from "vitest";

vi.mock("@opencode/plugin/tui", () => ({
  Plugin: { define: (value: unknown) => value },
}));

const { default: tui } = await import("../src/tui.ts");

type Toast = Record<string, unknown>;

type Command = {
  slash?: { name: string };
  run: () => Promise<void>;
};

function setupTui(rpc: unknown) {
  const toasts: Toast[] = [];
  let commands: Command[] = [];

  const context = {
    keymap: {
      layer: (factory: () => { commands: Command[] }) => {
        commands = factory().commands;
        return () => {};
      },
    },
    client: { rpc: () => rpc },
    ui: {
      toast: { show: (toast: Toast) => toasts.push(toast) },
      dialog: { prompt: async () => null },
    },
  };

  (tui as { setup: (ctx: unknown) => void }).setup(context);
  const status = commands.find((cmd) => cmd.slash?.name === "asya-status");
  if (!status) throw new Error("slash asya-status tidak terdaftar");
  return { status, toasts };
}

describe("/asya-status", () => {
  it("memanggil RPC status dengan objek input kosong", async () => {
    let seen: unknown = "belum dipanggil";
    const rpc = {
      status: async (input: unknown) => {
        seen = input;
        return {
          connected: true,
          name: "test mcp 2",
          organizationId: "org-1",
          enrolledAt: "2026-11-23T00:00:00.000Z",
          tokenPrefix: "asya_mcp",
        };
      },
    };
    const { status, toasts } = setupTui(rpc);

    await status.run();

    expect(seen).toEqual({});
    expect(toasts[0]?.variant).toBe("success");
    expect(String(toasts[0]?.message)).toContain("test mcp 2");
  });

  it("menampilkan pesan error RPC object, bukan [object Object]", async () => {
    const rpc = {
      status: async () => {
        throw { type: "rpc.invalid_input", message: "Expected object" };
      },
    };
    const { status, toasts } = setupTui(rpc);

    await status.run();

    expect(toasts[0]?.variant).toBe("error");
    expect(toasts[0]?.message).toBe("Expected object");
    expect(toasts[0]?.message).not.toContain("[object Object]");
  });
});
