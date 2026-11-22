# Design: Repo Publik `asya-mcp-plugin`

Tanggal: 2026-11-23
Status: menunggu persetujuan

## Intent

Plugin OpenCode untuk onboarding bearer token MCP ASYA dikeluarkan dari repo
`asya-core` ke repo publik mandiri. Alasannya: plugin harus bisa dipasang orang
lain hanya dengan alamat repo, dan repo core tidak boleh lagi menyimpan file
plugin. Config global OpenCode saat ini menunjuk path relatif yang ENOENT,
jadi pemindahan ini sekaligus memperbaiki pemasangan lokal.

## Goals

- Repo publik `github:AMETORY/asya-mcp-plugin` berisi plugin yang bisa dipasang
  lewat `plugins` di `opencode.json(c)` tanpa path lokal.
- README lengkap berisi install, konfigurasi, perintah, dan troubleshoot.
- Repo `asya-core` bersih dari file plugin.
- Config global OpenCode diperbarui ke alamat repo baru.
- Perubahan dicatat di `docs/v1-changelog.md` sesuai AGENTS.md.

## Non-goals

- Implementasi endpoint `/mcp` di edge function (masih 404; tetap dicatat jujur
  di README).
- Publish ke npm.
- Push, publish, atau deploy tanpa instruksi eksplisit.
- Menyimpan plain token, kode enrollasi, atau secret ke repo/config/chat.

## Anti-goals

- Plugin bergantung lagi pada file di `asya-core`.
- README mengandung contoh `url` yang di-hardcode sebagai nilai wajib diam-diam
  (url tetap opsi yang harus diisi pemakai).

## Constraints

- Format plugin OpenCode V2: `Plugin.define`, dependency `@opencode/plugin`.
- Nama package tetap `opencode-asya-mcp` (test lama mengharapkan nama ini).
- Path relatif di `plugins` di-resolve dari file config yang memuatnya — inilah
  penyebab ENOENT di `~/.config/opencode/opencode.json`.
- Bahasa dokumen dan output: Bahasa Indonesia.
- `SUPABASE_ACCESS_TOKEN` tidak tersedia; deploy/push manual oleh pengguna.

## Approaches

- **A — Ekstraksi penuh (dipilih).** Repo baru jadi satu-satunya sumber plugin;
  file di core dihapus, test dipindah, config diarahkan ke git package. Core
  benar-benar bersih. Trade-off: menyentuh config global pengguna.
- **B — Publikasi dulu, core dibersihkan belakangan.** Lebih aman untuk test lama,
  tapi tidak memenuhi syarat "file plugin tidak di repo asya core".
- **C — Paket npm.** Install lebih pendek lewat `opencode plugin add`, tetapi
  butuh akun/token npm dan nama paket unik. Ditunda sampai ada permintaan.

## Keputusan desain (call saya, bisa dikoreksi)

1. **Lokasi & remote.** Repo dibuat di
   `/Users/ametsuramet/AMETORY/PRODUCT/asya-mcp-plugin`, remote
   `git@github.com:AMETORY/asya-mcp-plugin.git`, visibilitas public saat
   dipush nanti (push tidak dilakukan oleh saya).
2. **Isi repo.** 5 file plugin dipindah apa adanya (`src/index.ts`,
   `src/enroll.ts`, `package.json`, `tsconfig.json`, `README.md` yang ditulis
   ulang), ditambah test yang dipindah dari core dan `vitest` sebagai
   devDependency. `package.json` tetap bernama `opencode-asya-mcp`.
3. **README.** Bagian: prasyarat, install via `github:AMETORY/asya-mcp-plugin`,
   contoh `opencode.jsonc` dengan `options.url` wajib, tiga perintah
   (`/asya-connect`, `/asya-rotate-token`, `/asya-status`), tool `asya_status`,
   aturan keamanan token, troubleshoot secret `MCP_TOKEN_ENCRYPTION_KEY`, dan
   catatan bahwa tool MCP belum tersedia (`/mcp` 404).
4. **Config global.** Entri di `~/.config/opencode/opencode.json` diganti dari
   `"package": "./plugins/opencode-asya-mcp"` menjadi
   `"package": "github:AMETORY/asya-mcp-plugin"`, `options.url` dipertahankan.
   Token tidak pernah ditulis ke config.
5. **Perubahan di core.** Hapus direktori `plugins/opencode-asya-mcp/`, hapus
   `src/test/opencodeAsyaMcpPlugin.test.ts` (test dipindah ke repo baru dengan
   path disesuaikan), tambah entri `docs/v1-changelog.md`, dan tambahkan
   catatan status satu baris di spec lama
   `docs/superpowers/specs/2026-11-22-organization-api-token-design.md`.
6. **Lisensi & `.gitignore`.** Saya usulkan MIT dan `.gitignore` standar Node;
   ini keputusan saya, bukan keputusan Anda — bilang kalau mau lain.

## Yang tersisa untuk builder

- Kata-kata final README dan contoh `url` (memakai domain ASYA yang sudah
  dipakai di config, tanpa secret).
- Isi pasti `.gitignore` dan teks lisensi.
- Verifikasi: test di repo baru lulus, `npx tsc --noEmit` di core tetap 0 error
  baru, tidak ada referensi plugin lama di core, `git diff --check` bersih.
