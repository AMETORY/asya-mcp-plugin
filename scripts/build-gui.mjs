// Build bundle CommonJS yang dimuat OpenCode Desktop lewat `./gui-experimental`.
// Desktop mengevaluasi berkas ini sebagai CJS dengan require-shim yang sudah
// menyediakan `@opencode/plugin/gui` dan `@opencode/plugin/rpc`; semua impor
// lokal harus masuk ke bundle, semua impor bare tetap external.
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = resolve(root, "prebuilt/gui.cjs");

await mkdir(dirname(outfile), { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: [resolve(root, "src/gui.ts")],
  outfile,
  bundle: true,
  format: "cjs",
  platform: "neutral",
  packages: "external",
  target: "es2022",
  logLevel: "info",
});
