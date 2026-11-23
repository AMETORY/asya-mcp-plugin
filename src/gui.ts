// GUI plugin asya-core. Slash command di composer Desktop memakai kontrak RPC
// yang sama dengan TUI. Kode enrollasi diminta lewat dialog tersembunyi, lalu
// dikirim sekali lewat RPC — tidak pernah jadi argumen chat, storage, atau log.
import { Plugin, Command } from "@opencode/plugin/gui";
import { isValidEnrollCode } from "./enroll.ts";
import { Asya, type AsyaMetadata } from "./rpc.ts";

// Skema RPC berbentuk JSON Schema, sehingga tipe kliennya `unknown`. Di sini
// dikunci ke kontrak metadata-only yang didefinisikan `src/rpc.ts`.
type AsyaRpc = {
  connect(input: { code: string }): Promise<AsyaMetadata>;
  rotate(input: { code: string }): Promise<AsyaMetadata>;
  status(): Promise<{ connected: boolean } & Partial<AsyaMetadata>>;
};

export default Plugin.define({
  setup(ctx) {
    const tampilkanError = (error: unknown) => {
      ctx.toast.show({
        title: "asya-core",
        description: error instanceof Error ? error.message : String(error),
        variant: "error",
      });
    };

    const mintaKode = async (): Promise<string | null> => {
      const code = await ctx.dialogs.prompt({
        title: "Kode enrollasi asya-core",
        description: "8 karakter [A-Z2-9], sekali pakai.",
        secret: true,
      });
      if (!code) return null;
      if (!isValidEnrollCode(code)) {
        ctx.toast.show({
          title: "asya-core",
          description: "Kode harus 8 karakter [A-Z2-9].",
          variant: "error",
        });
        return null;
      }
      return code.trim();
    };

    ctx.add(Command, {
      id: "asya.connect",
      title: "Hubungkan asya-core",
      slash: { name: "asya-connect" },
      run: async () => {
        const code = await mintaKode();
        if (!code) return;
        try {
          // `ctx.client` dibaca di sini: bisa berubah setelah restart server.
          const rpc = ctx.client.rpc(Asya) as unknown as AsyaRpc;
          const result = await rpc.connect({ code });
          ctx.toast.show({
            title: "asya-core",
            description: `Terhubung: ${result.name ?? "-"} (organisasi ${result.organizationId ?? "-"}).`,
            variant: "success",
          });
        } catch (error) {
          tampilkanError(error);
        }
      },
    });

    ctx.add(Command, {
      id: "asya.rotate",
      title: "Rotasi token asya-core",
      slash: { name: "asya-rotate-token" },
      run: async () => {
        const code = await mintaKode();
        if (!code) return;
        try {
          const rpc = ctx.client.rpc(Asya) as unknown as AsyaRpc;
          const result = await rpc.rotate({ code });
          ctx.toast.show({
            title: "asya-core",
            description: `Token dirotasi: ${result.name ?? "-"} (organisasi ${result.organizationId ?? "-"}).`,
            variant: "success",
          });
        } catch (error) {
          tampilkanError(error);
        }
      },
    });

    ctx.add(Command, {
      id: "asya.status",
      title: "Status asya-core",
      slash: { name: "asya-status" },
      run: async () => {
        try {
          const rpc = ctx.client.rpc(Asya) as unknown as AsyaRpc;
          const result = await rpc.status();
          if (!result.connected) {
            ctx.toast.show({
              title: "asya-core",
              description: "asya-core belum terenroll.",
              variant: "default",
            });
            return;
          }
          ctx.toast.show({
            title: "asya-core",
            description: `Terhubung: ${result.name ?? "-"} (organisasi ${result.organizationId ?? "-"}).`,
            variant: "success",
          });
        } catch (error) {
          tampilkanError(error);
        }
      },
    });
  },
});
