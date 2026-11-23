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

### Alternatif tanpa plugin: `opencode mcp add`

Bila token sudah dibuat dari **Generate Token** di dashboard dan alur enroll
plugin tidak dipakai, daftarkan server langsung lewat CLI:

```bash
export ASYA_MCP_TOKEN='<TOKEN>'
opencode mcp add asya-core --global \
  --url https://robrebioyfquemukodze.supabase.co/functions/v1/asya-mcp/mcp \
  --header 'Authorization=Bearer {env:ASYA_MCP_TOKEN}'
opencode mcp list
```

`{env:ASYA_MCP_TOKEN}` diresolve saat runtime, jadi token tidak tertulis di
`opencode.jsonc`. Karena endpoint ini memakai bearer token bukan OAuth, tambahkan
`"oauth": false` pada entri `mcp.servers["asya-core"]` di config — CLI `mcp add`
belum punya flag untuk itu. Pakai cara ini hanya bila plugin tidak dipakai:
alur enroll plugin sudah mendaftarkan server bernama `asya-core` otomatis.

## Pemakaian

| Perintah | Fungsi |
| --- | --- |
| `/asya-connect` | Hubungkan asya-core; kode enrollasi diminta lewat dialog |
| `/asya-rotate-token` | Rotasi token; kode diminta lewat dialog, token lama dicabut |
| `/asya-status` | Lihat metadata koneksi (tanpa token) lewat toast |

Kode enrollasi diminta melalui dialog di terminal maupun Desktop, bukan sebagai
argumen chat, sehingga tidak masuk transkrip sesi. Kode terdiri dari 8 karakter
`[A-Z2-9]`. Tool `asya_status` juga tersedia untuk pemeriksaan status dari agen;
keluarannya hanya metadata.

### Terminal vs Desktop

OpenCode Desktop sekarang mendukung ketiga slash command di atas lewat composer.
Dukungan ini disediakan oleh export `./gui-experimental` dari plugin ini; kode
enrollasi tetap diminta lewat dialog dengan input tersembunyi, bukan argumen
chat. Menjalankan `opencode` di terminal **tanpa `--standalone`** tetap didukung
dan memakai service yang sama dengan Desktop.

Desktop memuat bundle CommonJS yang sudah di-build di `prebuilt/gui.cjs` (bukan
sumber `.ts`). Setelah mengubah `src/gui.ts`, jalankan `npm run build:gui` lalu
commit ulang bundle tersebut agar pengguna yang meng-update plugin mendapat versi
baru. Nama script sengaja bukan `build` agar npm tidak menjalankan git-dep
preparation saat OpenCode menginstal plugin dari GitHub.

Alur yang disarankan:

1. Di Desktop, ketik `/asya-connect` di composer lalu isi kode enrollasi di
   dialog. Untuk rotasi/status, pakai `/asya-rotate-token` dan `/asya-status`.
2. Kredensial disimpan OpenCode lewat integration `asya-core`, sehingga service
   yang dipakai Desktop ikut memuat server MCP `asya-core`.
3. Setelah terhubung, pakai tool `asya_list_recent_journals` lewat percakapan
   biasa. Terminal tetap alternatif bila dialog Desktop tidak tersedia.

## Keamanan

Plain token dan kode enrollasi **tidak ditaruh** di `opencode.jsonc`, chat,
skill, file repo, atau log. Plugin menyerahkan token ke OpenCode lewat
`ctx.integration.connect.key`. Penyimpanan `ctx.storage` hanya berisi metadata
non-rahasia: prefix token, nama, waktu enrollasi, ID organisasi, dan nama server.

Jangan membagikan kode enrollasi: siapa pun yang memilikinya bisa menukarnya
menjadi token aktif sampai kode itu terpakai atau kedaluwarsa.

## Agen lain (Claude Code, Codex, Cursor)

Endpoint MCP berupa remote HTTP dan agnostik-agent. Agen selain OpenCode tidak
perlu plugin ini — cukup URL MCP dan header bearer token.

### Mendapatkan token

Di aplikasi ASYA buka **Pengaturan Organisasi → API Token (MCP) → Generate
Token**. Dashboard menampilkan **plain token sekali** beserta tombol salin;
setelah ditutup token tidak bisa dilihat lagi.

> Kode enrollasi 8 karakter **khusus OpenCode**. Agen di bawah memakai plain
> token dari dashboard, bukan kode enrollasi, dan tidak perlu memanggil
> `/enroll` lewat curl.

URL MCP produksi:
`https://robrebioyfquemukodze.supabase.co/functions/v1/asya-mcp/mcp`

Untuk project Supabase lain, formatnya
`https://<project>.supabase.co/functions/v1/asya-mcp/mcp`.

### Claude Code

```bash
claude mcp add --transport http asya-core \
  https://robrebioyfquemukodze.supabase.co/functions/v1/asya-mcp/mcp \
  --header "Authorization: Bearer <TOKEN>"
claude mcp list
```

### Codex

`~/.codex/config.toml` — direkomendasikan memakai environment variable agar
token tidak tertulis di file:

```toml
[mcp_servers.asya-core]
url = "https://robrebioyfquemukodze.supabase.co/functions/v1/asya-mcp/mcp"
bearer_token_env_var = "ASYA_MCP_TOKEN"
```

Alternatif lebih praktis tetapi lebih berisiko:

```toml
[mcp_servers.asya-core]
url = "https://robrebioyfquemukodze.supabase.co/functions/v1/asya-mcp/mcp"
http_headers = { Authorization = "Bearer <TOKEN>" }
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "asya-core": {
      "url": "https://robrebioyfquemukodze.supabase.co/functions/v1/asya-mcp/mcp",
      "headers": {
        "Authorization": "Bearer <TOKEN>"
      }
    }
  }
}
```

### Verifikasi dan batasan

Pada tiap agen, panggil `asya_list_recent_journals` dengan `{ "limit": 1 }`.
Iterasi 1 bersifat read-only — hanya tool itu yang tersedia.

Berbeda dengan OpenCode, agen-agen ini menyimpan token di file config lokal,
sehingga token bisa masuk ke riwayat shell atau file yang tidak sengaja
ter-commit. Jangan commit file config tersebut dan jangan bagikan token.

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

**Autocomplete `/asya-connect` tidak muncul di OpenCode Desktop.** Pastikan paket
sudah di-update ke versi yang mengekspor `./gui-experimental`:

```bash
opencode plugin update github:AMETORY/asya-mcp-plugin
```

Lalu restart Desktop. Bila masih tidak muncul, periksa log OpenCode untuk pesan
`failed to load plugin`. Enroll/rotasi/status tetap bisa lewat terminal sebagai
cadangan.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
