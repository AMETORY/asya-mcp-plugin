# Design: Instalasi MCP ASYA di agen lain (README-only)

Tanggal: 2026-11-23

## Intent / why

Pengguna agen selain OpenCode (Claude Code, Codex, Cursor) harus bisa
menghubungkan server `asya-core` tanpa plugin OpenCode. Endpoint `/mcp` sudah
berupa remote HTTP MCP dan agnostik-agent; yang belum ada hanyalah instruksi
instalasi yang bisa di-copy-paste.

## Goals

- README repo plugin memuat langkah singkat per agen + cara verifikasi.
- Satu blok "cara mendapat token" yang dipakai semua agen.
- Peringatan eksplisit bahwa pada jalur ini token masuk ke config agen.

## Non-goals / anti-goals

- Tidak membuat CLI, bridge stdio, plugin marketplace, atau kode baru.
- Tidak mengubah endpoint, migrasi SQL, atau UI dashboard.
- Anti-goal: token, kode enrollasi, atau secret ditulis ke chat, skill, source,
  atau log di repo ini.

## Constraints

- Dashboard sudah menampilkan **plain token sekali** saat Generate Token
  (`OrganizationForm.tsx`), lengkap dengan tombol salin. Jadi jalur README
  tidak perlu memanggil `/enroll` lewat curl — kode enrollasi tetap dipakai
  khusus untuk OpenCode.
- URL MCP: `https://<project>.supabase.co/functions/v1/asya-mcp/mcp`.
- File config agen bersifat lokal dan tidak boleh di-commit.
- Bahasa README: Bahasa Indonesia.

## Approaches

- **A. CLI + jembatan stdio** — satu implementasi untuk semua agen, token di
  keychain OS. Ditolak: butuh build, rilis, dan pengujian per OS.
- **B. Plugin native per agen** — paling terasa native, tapi implementasi
  terpisah per agen dan token tetap butuh penyimpanan aman. Ditolak.
- **C. README saja (DIPILIH)** — nol kode, instruksi copy-paste. Trade-off:
  token masuk file config agen / shell history. User memilih ini secara sadar
  demi kemudahan; trade-off akan dinyatakan dengan jelas di README.

## Keputusan yang sudah diambil

- Sumber kredensial: salin token dari dashboard, bukan curl `/enroll`.
- Claude Code: `claude mcp add --transport http asya-core <url> --header "Authorization: Bearer <TOKEN>"`;
  verifikasi dengan `claude mcp list` dan tool `asya_list_recent_journals`.
- Codex: entri `[mcp_servers.asya-core]` di `~/.codex/config.toml` berisi `url`
  dan `http_headers = { Authorization = "Bearer <TOKEN>" }`; alternatif lebih
  aman `bearer_token_env_var = "ASYA_MCP_TOKEN"`.
- Cursor: entri `mcpServers.asya-core` di `~/.cursor/mcp.json` berisi `url` dan
  `headers.Authorization`.
- Agen lain: remote HTTP MCP + header `Authorization: Bearer <TOKEN>`.
- Bagian OpenCode tidak berubah: tetap plugin + `/asya-connect`.
- README juga menyatakan batasan iterasi 1 (read-only, tool
  `asya_list_recent_journals` saja) dan aturan jangan berbagi token.

## Diserahkan ke builder

- Verifikasi ulang sintaks Cursor saat menulis (dokumentasi Cursor tidak
  berhasil di-fetch saat sesi desain).
- Pastikan semua nilai contoh memakai placeholder `<TOKEN>` / `<project>`,
  bukan token atau kode nyata.
