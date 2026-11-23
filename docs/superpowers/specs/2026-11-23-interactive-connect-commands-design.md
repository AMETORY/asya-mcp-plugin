# Design: Perintah connect interaktif via dialog TUI

Tanggal: 2026-11-23

## Intent / why

Saat ini `/asya-connect` dan `/asya-rotate-token` menerima kode enrollasi sebagai
argumen chat. Aturan proyek menyatakan kode/token yang pernah ditempel di chat
dianggap bocor. Dialog TUI menjaga kode tetap di luar transkrip sesi — jadi ini
perbaikan kepatuhan, bukan sekadar kenyamanan.

## Goals

- `/asya-connect` dan `/asya-rotate-token` meminta kode lewat dialog input.
- `/asya-status` menampilkan metadata lewat toast/dialog, bukan pesan chat.
- Kode dan token tetap tidak masuk chat, source, config, atau log.

## Non-goals / anti-goals

- Tidak mengubah endpoint `/enroll`, `/mcp`, migrasi SQL, atau dashboard.
- Tidak menyimpan kode enrollasi, tidak pernah mengembalikan token lewat RPC.
- Tidak menyentuh dokumentasi cross-agent (task README terpisah).

## Constraints

- Server part (`src/index.ts`) tidak punya `ctx.ui`; dialog hanya ada di TUI part.
- TUI part tidak punya `ctx.integration`, `ctx.storage`, `ctx.mcp`; butuh RPC.
- `DialogPromptOptions` tidak mendukung input masked. Kode bersifat sekali pakai,
  jadi terlihat sebentar di layar diterima, tetapi tidak boleh dipersistenkan.
- `@opencode/plugin@2.3.2` meng-export `./tui`; `Rpc` tersedia lewat wildcard
  `@opencode/plugin/rpc` → `dist/rpc.d.ts`. Tidak perlu JSX/OpenTUI peer dependency
  karena TUI hanya memakai dialog + keymap.

## Approaches

- **A. TUI memilik perintah (DIPILIH)** — slash command didaftarkan di TUI,
  dialog → RPC → server. Satu jalur, kode tidak pernah masuk chat.
  Konsekuensi: hanya aktif di TUI.
- **B. Server + TUI bernama beda** — kompatibel, tapi dua jalur dan dua nama.
- **C. Server + event RPC ke TUI** — satu nama dan headless-compatible, tapi
  butuh korelasi request/response dan bisa macet tanpa TUI.

User memilih A.

## Keputusan yang sudah diambil

- File baru `src/rpc.ts`: `Rpc.define({ id: "asya", ... })` dengan metode
  `connect({ code })`, `rotate({ code })`, `status()`. Output hanya metadata
  (`name`, `organizationId`, `enrolledAt`, `tokenPrefix`, `connected`) — tanpa
  `token`, tanpa kode.
- `src/index.ts`: refactor `enrollCommand` menjadi penerima `code: string`;
  daftarkan handler via `ctx.rpc.register(Asya, ...)`; hapus tiga
  `ctx.command.transform` (`asya-connect`, `asya-rotate-token`, `asya-status`);
  pertahankan tool `asya_status` dan alur `integration.connect.key` + `mcp.reload`.
  Validasi `extractEnrollCode(code)` tetap dipertahankan di server sebagai
  pertahanan kedua (test `source.test.ts` mengharuskannya).
- File baru `src/tui.ts`: `Plugin.define` dari `@opencode/plugin/tui`. Daftarkan
  keymap layer global dengan slash command:
  - `/asya-connect`, `/asya-rotate-token` → `dialog.prompt({ title: "Kode enrollasi",
    placeholder: "XXXXXXXX" })`; validasi lokal `/^[A-Z2-9]{8}$/`; panggil
    `context.client.rpc(Asya).connect/rotate({ code })`; hasil → `toast.show`
    metadata saja. Escape / selesai tanpa kode → tidak ada aksi.
  - `/asya-status` → `context.client.rpc(Asya).status()` → `toast.show`.
  - Error RPC → `toast.show({ variant: "error", message })` dengan pesan dari
    server (sudah bebas token).
- `package.json`: tambah export `"./tui"` dan `"./rpc"`.
- Test: perbarui `source.test.ts` (exports baru, RPC tidak mengembalikan token,
  TUI tidak menyimpan kode); tambah test untuk validasi kode di TUI.

## Diserahkan ke builder

- Pastikan `context.client.rpc(Asya)` dibaca di dalam `run` (client bisa berubah
  setelah server restart, sesuai docs).
- Verifikasi tidak ada `console.log` atau `synthetic` yang memuat kode/token di
  jalur baru.
- Jalankan `npm test`, `npx tsc --noEmit`, dan `git diff --check`. (Aturan
  `graphify update .` berlaku di repo core, bukan repo plugin ini.)
