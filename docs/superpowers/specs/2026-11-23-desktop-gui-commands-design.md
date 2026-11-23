# Desain: Slash command asya-core di OpenCode Desktop

Tanggal: 2026-11-23
Status: disetujui
Pendekatan: A — paritas slash command (rekomendasi, disetujui user)

## Masalah

`/asya-connect`, `/asya-rotate-token`, dan `/asya-status` hanya muncul di terminal
CLI. OpenCode Desktop tidak memuat export `./tui`; Desktop hanya memuat komponen
GUI dari export `./gui-experimental`. Plugin ini belum punya export itu.

## Tujuan

Ketiga perintah di atas bisa diketik di composer Desktop, dengan kontrak dan
perilaku yang sama seperti di TUI: kode enrollasi diminta lewat dialog, dipakai
sekali lewat RPC, lalu dibuang. Tidak ada perubahan pada server plugin atau
kontrak RPC.

## Keputusan

### 1. File baru `src/gui.ts`

Default export `Plugin.define` dari `@opencode/plugin/gui`. Mendaftarkan tiga
`Command` lewat `ctx.add(Command, …)` dengan `slash.name` yang sama persis:

| Command | `slash.name` | Aksi RPC |
|---|---|---|
| Hubungkan asya-core | `asya-connect` | `rpc.connect({ code })` |
| Rotasi token asya-core | `asya-rotate-token` | `rpc.rotate({ code })` |
| Status asya-core | `asya-status` | `rpc.status()` |

Tidak ada `slash.arguments`: kode tidak boleh diketik sebagai argumen perintah.

### 2. Pakai ulang modul yang ada

- `isValidEnrollCode()` dari `src/enroll.ts` — validasi 8 karakter `[A-Z2-9]`.
- `Asya` dan `type AsyaMetadata` dari `src/rpc.ts` — kontrak RPC metadata-only.

Tidak ada logika enroll baru, tidak ada fetch langsung, tidak ada penyimpanan
kredensial di sisi GUI.

### 3. Perbedaan API GUI vs TUI yang harus dihormati

| Aspek | TUI (`src/tui.ts`) | GUI (`src/gui.ts`) |
|---|---|---|
| Daftar command | `context.keymap.layer(...)` | `ctx.add(Command, ...)` |
| Import | `@opencode/plugin/tui` | `@opencode/plugin/gui` |
| Prompt | `context.ui.dialog.prompt()` | `ctx.dialogs.prompt()` |
| Toast | `context.ui.toast.show({ message, variant })` | `ctx.toast.show({ description, variant })` |
| Varian info | `"info"` | `"default"` |
| Klien RPC | `context.client.rpc(Asya)` | `ctx.client.rpc(Asya)` |

Prompt GUI memakai `secret: true` untuk kode enrollasi. Pesan toast memakai
`description`, bukan `message`. Status "belum terenroll" memakai varian
`"default"` karena GUI tidak punya `"info"`.

### 4. Ekspor plugin

Tambah ke `package.json`:

```json
"./gui-experimental": "./src/gui.ts"
```

Tanpa mengubah export `"."`, `"./tui"`, atau `"./rpc"`. Tidak ada dependensi
baru — `@opencode/plugin` sudah terpasang dan `./gui` sudah tersedia di v2.3.2.

### 5. Keamanan

- Kode enrollasi hanya masuk lewat `ctx.dialogs.prompt({ secret: true })`, lalu
  dikirim sebagai input RPC. Tidak pernah jadi argumen chat, teks toast, storage,
  source, `opencode.json(c)`, atau log.
- Token tidak pernah melintas ke GUI. RPC sudah mengembalikan metadata saja.
- `src/gui.ts` tidak boleh berisi fetch, `ctx.storage`, atau `ctx.integration`.

### 6. Dokumentasi

Perbarui `README.md` bagian **Terminal vs Desktop**:

- Desktop sekarang mendukung ketiga slash command lewat composer.
- Alur enroll bisa dilakukan langsung di Desktop; terminal tetap didukung.
- Catatan troubleshooting lama ("autocomplete tidak muncul di Desktop karena
  platform") diganti dengan catatan bahwa perubahan ini baru aktif setelah plugin
  di-update ke versi yang punya `./gui-experimental` dan Desktop direstart.

Guard di `test/readme.test.ts` disesuaikan: tetap melarang token/kode nyata,
tetapi tidak lagi menuntut kalimat "Desktop belum mendukung slash command".

### 7. Test

File baru `test/gui.test.ts` (pola mengikuti `test/source.test.ts` dan
`test/rpcFeedback.test.ts`) memeriksa sumber `src/gui.ts`:

- ekspor `./gui-experimental` ada di `package.json`;
- ketiga `slash.name` hadir;
- `ctx.dialogs.prompt` dipakai dengan `secret: true`;
- tidak ada argumen slash (`arguments` tidak muncul);
- tidak ada `fetch`, `ctx.storage`, atau `ctx.integration`;
- tidak ada literal token/kode nyata, hanya placeholder.

Guard lama (`test/enroll.test.ts`, `test/rpc.test.ts`, `test/rpcFeedback.test.ts`,
`test/source.test.ts`, `test/readme.test.ts`) tetap lolos.

## Verifikasi

```bash
npm test
npx tsc --noEmit
git diff --check
```

## Batasan dan konsekuensi

- GUI API masih berlabel *experimental* di OpenCode 2.3.2; permukaan ini bisa
  berubah di versi berikutnya.
- Perubahan baru efektif di Desktop setelah: commit → push ke
  `github:AMETORY/asya-mcp-plugin` → `opencode plugin update
  github:AMETORY/asya-mcp-plugin` → restart Desktop. Push **tidak** dilakukan
  tanpa izin eksplisit terpisah.
- Tidak ada perubahan pada endpoint server, migrasi, atau deploy produksi.

## Di luar scope

- Panel status permanent di Settings (opsi B dari brainstorming).
- Web Push / notifikasi browser.
- Autocomplete untuk agen selain OpenCode.
