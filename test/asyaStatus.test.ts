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

function setupTui(rpc: unknown, code: string | null = null) {
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
      dialog: { prompt: async () => code },
    },
  };

  (tui as { setup: (ctx: unknown) => void }).setup(context);
  const status = commands.find((cmd) => cmd.slash?.name === "asya-status");
  if (!status) throw new Error("slash asya-status tidak terdaftar");
  return { status, commands, toasts };
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

  it("menampilkan nama organisasi, bukan UUID", async () => {
    const rpc = {
      status: async () => ({
        connected: true,
        name: "test mcp 2",
        organizationId: "12ac0322-f7e5-4478-9883-bae46253c0ce",
        organizationName: "Demo Company",
        enrolledAt: "2026-11-23T00:00:00.000Z",
        tokenPrefix: "asya_mcp",
      }),
    };
    const { status, toasts } = setupTui(rpc);

    await status.run();

    expect(toasts[0]?.message).toContain("organisasi Demo Company");
    expect(toasts[0]?.message).not.toContain("12ac0322");
  });

  it("fallback ke UUID bila nama organisasi tidak tersedia", async () => {
    const rpc = {
      status: async () => ({
        connected: true,
        name: "test mcp 2",
        organizationId: "12ac0322-f7e5-4478-9883-bae46253c0ce",
        enrolledAt: "2026-11-23T00:00:00.000Z",
        tokenPrefix: "asya_mcp",
      }),
    };
    const { status, toasts } = setupTui(rpc);

    await status.run();

    expect(toasts[0]?.message).toContain("12ac0322-f7e5-4478-9883-bae46253c0ce");
  });

  it("menampilkan nama organisasi pada toast connect dan rotate", async () => {
    const meta = {
      connected: true,
      name: "test mcp 2",
      organizationId: "12ac0322-f7e5-4478-9883-bae46253c0ce",
      organizationName: "Demo Company",
      enrolledAt: "2026-11-23T00:00:00.000Z",
      tokenPrefix: "asya_mcp",
    };
    const rpc = { connect: async () => meta, rotate: async () => meta };
    const { commands, toasts } = setupTui(rpc, "ABCDEFG2");

    for (const name of ["asya-connect", "asya-rotate-token"]) {
      const command = commands.find((cmd) => cmd.slash?.name === name);
      if (!command) throw new Error(`slash ${name} tidak terdaftar`);
      await command.run();
    }

    expect(toasts).toHaveLength(2);
    for (const toast of toasts) {
      expect(toast.message).toContain("organisasi Demo Company");
      expect(toast.message).not.toContain("12ac0322");
    }
  });
});
