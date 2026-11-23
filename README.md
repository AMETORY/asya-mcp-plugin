# opencode-asya-mcp

Plugin OpenCode V2 untuk onboarding kredensial MCP ASYA. Plugin menukar kode
enrollasi sekali pakai menjadi bearer token, lalu mendaftarkan server MCP
`asya-core` ke sesi OpenCode. Kredensial disimpan oleh OpenCode — bukan di file
konfigurasi.

## Prasyarat

- OpenCode V2 dengan file `opencode.jsonc`.
- Token MCP dibuat dari **Pengaturan Organisasi → API Token (MCP)** di aplikasi
  ASYA. Generate token menghasilkan kode enrollasi 8 karakter yang hanya tampil
  sekali.
- Edge function `asya-mcp` sudah terpasang dan secret
  `MCP_TOKEN_ENCRYPTION_KEY` sudah benar (lihat Troubleshooting).

## Instalasi

Tambahkan paket ini ke `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "github:AMETORY/asya-mcp-plugin",
      "options": {
        "url": "https://<project>.supabase.co/functions/v1"
      }
    }
  ]
}
```

`url` **wajib diisi** — plugin menolak startup tanpa opsi ini. Ganti
`<project>` dengan project Supabase Anda. Opsi lain bersifat opsional:

| Opsi | Default | Fungsi |
| --- | --- | --- |
| `functionsPath` | `/functions/v1/asya-mcp` | Path edge function |
| `serverName` | `asya-core` | Nama server MCP yang didaftarkan |
| `mcpUrl` | `<url>/mcp` | URL server MCP |

Simpan file config, lalu jalankan `/reload` di OpenCode. Plugin hanya perlu
dipasang sekali; kredensial tidak perlu ditambahkan ke config.

## Pemakaian

| Perintah | Fungsi |
| --- | --- |
| `/asya-connect <kode>` | Tukar kode enrollasi 8 karakter menjadi kredensial |
| `/asya-rotate-token <kode>` | Rotasi dengan kode dari token baru; token lama dicabut |
| `/asya-status` | Lihat metadata koneksi (tanpa token) |

Kode enrollasi terdiri dari 8 karakter `[A-Z2-9]`. Tool `asya_status` juga
tersedia untuk pemeriksaan status dari agen; keluarannya hanya metadata.

## Keamanan

Plain token dan kode enrollasi **tidak ditaruh** di `opencode.jsonc`, chat,
skill, file repo, atau log. Plugin menyerahkan token ke OpenCode lewat
`ctx.integration.connect.key`. Penyimpanan `ctx.storage` hanya berisi metadata
non-rahasia: prefix token, nama, waktu enrollasi, ID organisasi, dan nama server.

Jangan membagikan kode enrollasi: siapa pun yang memilikinya bisa menukarnya
menjadi token aktif sampai kode itu terpakai atau kedaluwarsa.

## Troubleshooting

**`MCP_TOKEN_ENCRYPTION_KEY tidak diatur atau tidak valid (harus 32-byte base64).`**
Secret edge function wajib berupa 32 byte dalam base64url tanpa padding. Buat
nilai baru di terminal Anda:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | wc -c
# harus 43
```

Salin 43 karakter yang dihasilkan (tanpa `wc -c`) ke Supabase Dashboard →
Edge Functions → Secrets → `MCP_TOKEN_ENCRYPTION_KEY`, lalu deploy ulang
`asya-mcp`. Jangan pakai `openssl rand -base64 32` apa adanya: keluarannya
mengandung `=` dan ditolak decoder.

**Plugin gagal dimuat setelah `/reload`.** Pastikan repo publik tersedia dan
OpenCode bisa mengambil paket dari GitHub. Periksa log OpenCode untuk pesan
`failed to load plugin`.

**Tool MCP belum bisa dipanggil.** Endpoint `/mcp` belum diimplementasikan dan
mengembalikan 404. Onboarding dan rotasi kredensial tetap berfungsi; pemanggilan
tool baru akan tersedia setelah endpoint tersebut dibangun.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
