// TUI plugin asya-core. Kode enrollasi diminta lewat dialog, dipakai sekali
// untuk RPC, lalu dibuang — tidak pernah jadi argumen chat, storage, atau log.
import { Plugin } from "@opencode/plugin/tui";
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
  id: "asya-mcp.tui",
  setup(context) {
    const tampilkanError = (error: unknown) => {
      context.ui.toast.show({
        title: "asya-core",
        message: error instanceof Error ? error.message : String(error),
        variant: "error",
      });
    };

    const mintaKode = async (): Promise<string | null> => {
      const code = await context.ui.dialog.prompt({
        title: "Kode enrollasi asya-core",
        description: "8 karakter [A-Z2-9], sekali pakai.",
        placeholder: "XXXXXXXX",
      });
      if (!code) return null;
      if (!isValidEnrollCode(code)) {
        context.ui.toast.show({
          message: "Kode harus 8 karakter [A-Z2-9].",
          variant: "error",
        });
        return null;
      }
      return code.trim();
    };

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "asya.connect",
          title: "Hubungkan asya-core",
          slash: { name: "asya-connect" },
          run: async () => {
            const code = await mintaKode();
            if (!code) return;
            try {
              // `context.client` dibaca di sini: bisa berubah setelah restart server.
              const rpc = context.client.rpc(Asya) as unknown as AsyaRpc;
              const result = await rpc.connect({ code });
              context.ui.toast.show({
                title: "asya-core",
                message: `Terhubung: ${result.name ?? "-"} (organisasi ${result.organizationId ?? "-"}).`,
                variant: "success",
              });
            } catch (error) {
              tampilkanError(error);
            }
          },
        },
        {
          id: "asya.rotate",
          title: "Rotasi token asya-core",
          slash: { name: "asya-rotate-token" },
          run: async () => {
            const code = await mintaKode();
            if (!code) return;
            try {
              const rpc = context.client.rpc(Asya) as unknown as AsyaRpc;
              const result = await rpc.rotate({ code });
              context.ui.toast.show({
                title: "asya-core",
                message: `Token dirotasi: ${result.name ?? "-"} (organisasi ${result.organizationId ?? "-"}).`,
                variant: "success",
              });
            } catch (error) {
              tampilkanError(error);
            }
          },
        },
        {
          id: "asya.status",
          title: "Status asya-core",
          slash: { name: "asya-status" },
          run: async () => {
            try {
              const rpc = context.client.rpc(Asya) as unknown as AsyaRpc;
              const result = await rpc.status();
              if (!result.connected) {
                context.ui.toast.show({
                  title: "asya-core",
                  message: "asya-core belum terenroll.",
                  variant: "info",
                });
                return;
              }
              context.ui.toast.show({
                title: "asya-core",
                message: `Terhubung: ${result.name ?? "-"} (organisasi ${result.organizationId ?? "-"}).`,
                variant: "success",
              });
            } catch (error) {
              tampilkanError(error);
            }
          },
        },
      ],
    }));
  },
});
