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

> **Penting:** saat memakai plugin, **jangan** menambahkan blok
> `mcp.servers["asya-core"]` ke config. Plugin yang mendaftarkan server MCP
> secara otomatis setelah enroll. Entri statis tanpa kredensial membuat
> `opencode mcp list` melaporkan `⚠ asya-core   needs authentication`, dan plugin
> versi terbaru sengaja tidak menimpa entri yang sudah ada (untuk menjaga
> kredensial OAuth). Hapus blok `mcp` bila config Anda memilikinya.

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

Simpan file config, lalu jalankan `/reload` di OpenCode (atau restart OpenCode).
Plugin hanya perlu dipasang sekali; kredensial tidak perlu ditambahkan ke config.
Pastikan plugin termuat:

```bash
opencode plugin list          # harus menampilkan asya-mcp
opencode plugin update github:AMETORY/asya-mcp-plugin   # bila perlu update
```

**Alur pertama kali dengan plugin:**

1. Di aplikasi ASYA, buka **Pengaturan Organisasi → API Token (MCP) →
   Generate Token**. Kode enrollasi 8 karakter hanya tampil sekali dan
   kedaluwarsa dalam 10 menit. Jangan menempelkannya di chat.
2. Di terminal OpenCode, ketik `/asya-connect`, lalu isi kode di dialog input
   tersembunyi.
3. Cek `/asya-status` dan `opencode mcp list` — status harus
   `✓ asya-core   connected`.
4. Bila sesi/direktori lain masih merah setelah enroll, jalankan
   `opencode reload` di sesi tersebut.

Nama slash command yang terdaftar persis `/asya-connect`,
`/asya-rotate-token`, dan `/asya-status`. **Tidak ada perintah `/asya`** —
mengetik `/asya` tidak akan menampilkan autocomplete.

### Opsi OAuth lewat browser (hanya setelah rollout aktif)

Untuk OpenCode yang mendukung OAuth MCP, cukup daftarkan URL server lalu
masuk lewat browser — tidak perlu menyalin bearer token ke chat maupun config.

> **Prasyarat produksi:** migration `20261123000002_asya_mcp_oauth.sql`, secret
> `ASYA_OAUTH_SIGNING_KEY` dan `ASYA_OAUTH_COOKIE_KEY`, deploy ulang edge
> function, serta redirect URL `<issuer>/return/otp` dan `<issuer>/return/google`
> harus sudah terpasang. Sebelum itu server membalas `401` **tanpa** header
> `WWW-Authenticate`, dan `opencode mcp auth asya-core` tidak akan berhasil.
> Cek cepat:
>
> ```bash
> curl -sSI https://robrebioyfquemukodze.supabase.co/functions/v1/asya-mcp/mcp | grep -i www-authenticate
> ```

```bash
opencode mcp add --global asya-core \
  --url https://robrebioyfquemukodze.supabase.co/functions/v1/asya-mcp/mcp
```

Saat server mengembalikan `401`, OpenCode membaca `resource_metadata` dari header
`WWW-Authenticate`, menemukan metadata authorization server, lalu membuka halaman
login ASYA. Masukkan email ASYA; tautan sekali pakai dikirim ke email (pilihan
Google tersedia bila diaktifkan admin). Setelah sign-in, OpenCode menyimpan token
OAuth-nya sendiri dan memanggil tool secara otomatis.

- `organization_id` bersifat opsional. Bila tidak diberikan, server memakai klaim
  `organization_id` dari access token OAuth, lalu fallback ke
  `mcp_oauth_active_organization_id`. Agen boleh mengirim UUID organisasi lain,
  tetapi RPC memastikan akun masih menjadi anggota aktif organisasi tersebut.
  Contoh: `asya_list_recent_journals({ "limit": 1 })` atau
  `asya_list_recent_sales({ "organization_id": "<uuid>", "limit": 1 })`.
- Kredensial OAuth dikelola OpenCode. Plugin tidak menimpa entri `asya-core`
  hasil `opencode mcp add` maupun entri OAuth yang sudah ada.
- Prasyarat produksi dan cara ceknya ada di catatan di atas.

### Alternatif tanpa plugin: token via `opencode mcp add`

Bila OAuth tidak tersedia atau token sudah dibuat dari **Generate Token** di
dashboard, daftarkan server langsung lewat CLI:

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

Pada tiap agen, panggil `asya_get_active_organization` untuk melihat organisasi
yang dipakai server, lalu uji `asya_list_recent_journals` dengan `{ "limit": 1 }`.
Iterasi ini bersifat read-only dengan enam tool: `asya_get_active_organization`,
`asya_list_recent_journals`, `asya_list_recent_sales`,
`asya_list_recent_purchases`, `asya_list_stock`, dan
`asya_get_accounting_summary`. Tidak ada tool tulis dan tidak ada query generik.

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

**`opencode mcp list` melaporkan `⚠ asya-core   needs authentication`.** Entri
`asya-core` ada tetapi tanpa kredensial. Kalau memakai plugin, hapus blok
`mcp.servers["asya-core"]` dari config, jalankan `/reload`, lalu enroll ulang
dengan kode baru lewat `/asya-connect`. Plugin tidak menimpa entri statis/OAuth
yang sudah ada. Kalau memakai jalur OAuth, pastikan prasyarat di atas terpenuhi
dan server mengirim header `WWW-Authenticate`.

**`/asya` tidak muncul di autocomplete.** Itu wajar: command yang terdaftar
hanya `/asya-connect`, `/asya-rotate-token`, dan `/asya-status`.

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
