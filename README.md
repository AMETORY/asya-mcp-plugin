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
        "url": "https://robrebioyfquemukodze.supabase.co/functions/v1"
      }
    }
  ]
}
```

`url` **wajib diisi** — plugin menolak startup tanpa opsi ini. Contoh di atas
memakai `https://robrebioyfquemukodze.supabase.co/functions/v1`, server ASYA
produksi yang bisa dipakai apa adanya. Untuk project Supabase sendiri, ganti
dengan `https://<project>.supabase.co/functions/v1`. Opsi lain bersifat opsional:

| Opsi | Default | Fungsi |
| --- | --- | --- |
| `functionsPath` | `/asya-mcp` | Path edge function relatif terhadap `url` |
| `serverName` | `asya-core` | Nama server MCP yang didaftarkan |
| `mcpUrl` | `<url>/asya-mcp/mcp` | URL server MCP |

`url` sudah mengandung `/functions/v1`, jadi `functionsPath` tidak boleh
mengulang segmen itu. Hasil akhir enroll:
`https://<project>.supabase.co/functions/v1/asya-mcp/enroll`.

Simpan file config, lalu jalankan `/reload` di OpenCode. Plugin hanya perlu
dipasang sekali; kredensial tidak perlu ditambahkan ke config.

## Pemakaian

| Perintah | Fungsi |
| --- | --- |
| `/asya-connect` | Hubungkan asya-core; kode enrollasi diminta lewat dialog |
| `/asya-rotate-token` | Rotasi token; kode diminta lewat dialog, token lama dicabut |
| `/asya-status` | Lihat metadata koneksi (tanpa token) lewat toast |

Kode enrollasi diminta melalui dialog TUI, bukan sebagai argumen chat, sehingga
tidak masuk transkrip sesi. Kode terdiri dari 8 karakter `[A-Z2-9]`. Tool
`asya_status` juga tersedia untuk pemeriksaan status dari agen; keluarannya
hanya metadata.

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

**`Enroll gagal: HTTP 404`.** Ini spesifik endpoint enroll, bukan gangguan
tool MCP. Periksa `url` dan `functionsPath`: keduanya tidak boleh menggandakan
`/functions/v1`.
Dengan contoh konfigurasi ASYA produksi di atas, hasilnya harus
`https://robrebioyfquemukodze.supabase.co/functions/v1/asya-mcp/enroll`.

**Plugin gagal dimuat setelah `/reload`.** Pastikan repo publik tersedia dan
OpenCode bisa mengambil paket dari GitHub. Periksa log OpenCode untuk pesan
`failed to load plugin`.

**Tool MCP belum bisa dipanggil setelah enroll.** Pastikan `/asya-status`
(atau `asya_status`) melaporkan koneksi aktif, lalu jalankan `/reload` agar
server `asya-core` memuat ulang kredensialnya.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
