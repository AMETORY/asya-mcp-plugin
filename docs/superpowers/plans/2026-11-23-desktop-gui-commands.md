# Slash Command Desktop asya-core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat `/asya-connect`, `/asya-rotate-token`, dan `/asya-status` bisa dipakai di composer OpenCode Desktop dengan perilaku identik seperti di TUI.

**Architecture:** Tambah export GUI (`./gui-experimental`) yang mendaftarkan tiga `Command` dengan `slash.name` sama seperti TUI. GUI hanya meminta kode enrollasi lewat dialog `secret: true`, lalu memanggil RPC metadata-only yang sudah ada; server plugin dan kontrak RPC tidak diubah.

**Tech Stack:** TypeScript, OpenCode Plugin API v2.3.2 (`@opencode/plugin/gui`), Vitest 4.

**Spec:** `docs/superpowers/specs/2026-11-23-desktop-gui-commands-design.md`

## Global Constraints

- Pesan UI dan dokumentasi berbahasa Indonesia.
- Kode enrollasi tepat 8 karakter `[A-Z2-9]`, sekali pakai, divalidasi `isValidEnrollCode()` dari `src/enroll.ts`.
- Kode enrollasi tidak boleh menjadi argumen chat/slash; hanya lewat `ctx.dialogs.prompt({ secret: true })`.
- Plain token dan kode enrollasi tidak boleh muncul di chat, skill, `opencode.json(c)`, source, config, atau log.
- GUI tidak boleh berisi `fetch`, `ctx.storage`, `ctx.integration`, atau `console.log`.
- Kontrak RPC `src/rpc.ts` tetap metadata-only; tanpa token dan tanpa kode.
- Tidak menambah dependensi; `@opencode/plugin` v2.3.2 sudah menyediakan `./gui`.
- URL produksi bawaan: `https://robrebioyfquemukodze.supabase.co/functions/v1`.
- Verifikasi wajib: `npm test`, `npx tsc --noEmit`, `git diff --check`.
- Jangan push atau deploy tanpa izin eksplisit terpisah.
- Format commit conventional, ringkasan Bahasa Indonesia (ikut riwayat repo).

## Review Focus

- Dialog dibatalkan (`prompt` mengembalikan `undefined`) → tidak ada panggilan RPC dan tidak ada toast error. Pin dengan tes source: `if (!code) return;` hadir sebelum pemanggilan RPC.
- Kode ditolak (kurang dari 8 karakter, huruf kecil, atau substring teks lain) → RPC tidak dipanggil, toast error muncul. Pin dengan tes source: `isValidEnrollCode(code)` dipakai dan tidak ada regex inline di `src/gui.ts`.
- RPC gagal (server/error jaringan) → toast `variant: "error"`, bukan exception yang membocorkan detail kredensial. Pin dengan tes source: `try`/`catch` dan `tampilkanError`/`variant: "error"`.
- Status belum enroll → toast `variant: "default"` dengan pesan "belum terenroll", karena GUI tidak punya varian `"info"`. Pin dengan tes source: `variant: "default"` ada dan `variant: "info"` tidak ada.
- Server plugin restart → klien RPC dibaca di dalam `run`, bukan sekali saat setup. Pin dengan tes source: `ctx.client.rpc(Asya)` muncul tepat 3 kali (satu per command).

---

### Task 1: Command GUI dan export `./gui-experimental`

**Files:**
- Create: `src/gui.ts`
- Modify: `package.json` (peta `exports`)
- Test: `test/gui.test.ts`

**Interfaces:**
- Consumes: `isValidEnrollCode(code: string): boolean` dan `Asya`, `type AsyaMetadata` dari Task sebelumnya (sudah ada di repo).
- Produces: default export plugin GUI di `src/gui.ts`; tiga slash command `asya-connect`, `asya-rotate-token`, `asya-status`; entri exports `"./gui-experimental": "./src/gui.ts"`.

- [x] **Step 1: Tulis test yang gagal di `test/gui.test.ts`**

Buat file dengan pola `test/source.test.ts` (baca sumber via `readFileSync`, `root` dari `fileURLToPath(import.meta.url)`). Tulis satu `describe("plugin GUI asya-core", …)` berisi test berikut:

1. `it("paket mengekspor ./gui-experimental", …)` — `JSON.parse(read("package.json")).exports["./gui-experimental"] === "./src/gui.ts"`.
2. `it("mendaftarkan tiga slash command dengan nama yang sama dengan TUI", …)` — untuk tiap nama `asya-connect`, `asya-rotate-token`, `asya-status`: `gui` mengandung `slash: { name: "<nama>" }` dan `read("src/tui.ts")` juga mengandung string itu; `gui` mengandung `ctx.add(Command`.
3. `it("kode diminta lewat prompt rahasia dan divalidasi sebelum RPC", …)` — `gui` mengandung `ctx.dialogs.prompt(`, `secret: true`, `isValidEnrollCode(`; tidak mengandung `arguments: true` maupun `slash.arguments`.
4. `it("membatalkan dialog atau kode salah tidak memanggil RPC", …)` — `gui` mengandung `if (!code) return;` dan `if (!isValidEnrollCode(code))`.
5. `it("klien RPC dibaca per command dan toast memakai konvensi GUI", …)` — `gui.split("ctx.client.rpc(Asya)").length - 1 === 3`; mengandung `description:` dan `variant: "default"`; tidak mengandung `message:` maupun `variant: "info"`.
6. `it("GUI tidak menyimpan atau mengirim kredensial sendiri", …)` — `gui` tidak mengandung `console.log`, `fetch(`, `ctx.storage`, `ctx.integration`; tidak cocok dengan `/asya_mcp[A-Za-z0-9_-]{12,}/` maupun `/(?<![A-Za-z0-9\[-])[A-Z2-9]{8}(?![A-Za-z0-9\]-])/`. Jangan pakai placeholder 8 huruf kapital di source karena akan memicu guard ini.

- [x] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test -- test/gui.test.ts`
Expected: FAIL — file `test/gui.test.ts` gagal membaca `src/gui.ts` (`ENOENT`) dan `exports["./gui-experimental"]` tidak ada.

- [x] **Step 3: Implementasi `src/gui.ts`**

Impor `Plugin` dan `Command` dari `@opencode/plugin/gui`, `isValidEnrollCode` dari `./enroll.ts`, serta `Asya` dan `type AsyaMetadata` dari `./rpc.ts`.

Definisikan tipe lokal `AsyaRpc` dengan tiga method: `connect(input: { code: string }): Promise<AsyaMetadata>`, `rotate(input: { code: string }): Promise<AsyaMetadata>`, `status(): Promise<{ connected: boolean } & Partial<AsyaMetadata>>` (sama seperti `src/tui.ts`).

Default export `Plugin.define({ setup(ctx) { … } })` dengan:

- `tampilkanError` — `ctx.toast.show({ title: "asya-core", description: <pesan error>, variant: "error" })`.
- `mintaKode` — `await ctx.dialogs.prompt({ title: "Kode enrollasi asya-core", description: "8 karakter [A-Z2-9], sekali pakai.", secret: true })`; kembalikan `null` bila falsy, tampilkan toast error `variant: "error"` dan kembalikan `null` bila `!isValidEnrollCode(code)`, otherwise `code.trim()`.
- Tiga `ctx.add(Command, { … })` dengan `id` `asya.connect`, `asya.rotate`, `asya.status`; `title` "Hubungkan asya-core", "Rotasi token asya-core", "Status asya-core"; `slash: { name: … }` sesuai tabel di atas; `run` async.
- Di dalam tiap `run` (bukan di scope setup): `const rpc = ctx.client.rpc(Asya) as unknown as AsyaRpc;`.
- `connect` dan `rotate`: panggil `rpc.connect`/`rpc.rotate` dengan `{ code }`, lalu toast `variant: "success"` berisi `Terhubung: <name> (organisasi <organizationId>).` / `Token dirotasi: …`.
- `status`: `rpc.status()`; bila `!connected`, toast `variant: "default"` berisi `asya-core belum terenroll.` dan return; selain itu toast `variant: "success"` dengan metadata yang sama.
- Bungkus setiap pemanggilan RPC dengan `try`/`catch` yang memanggil `tampilkanError`.
- Gunakan `description`, bukan `message`, untuk semua toast (API GUI). Jangan menambahkan `placeholder` pada dialog.

Tambah entri `"./gui-experimental": "./src/gui.ts"` ke `exports` di `package.json`, setelah `"./rpc"`. Jangan ubah entri lain.

- [x] **Step 4: Jalankan test GUI sampai lolos**

Run: `npm test -- test/gui.test.ts`
Expected: PASS — 6 test.

- [x] **Step 5: Commit Task 1**

```bash
git add src/gui.ts package.json test/gui.test.ts
git commit -m "feat: tambah slash command asya-core untuk OpenCode Desktop"
```

---

### Task 2: Dokumentasi dan guard README

**Files:**
- Modify: `README.md:66-82`, `README.md:199-202`
- Modify: `test/readme.test.ts:56-61`

**Interfaces:**
- Consumes: keberadaan `./gui-experimental` dan tiga slash command dari Task 1.
- Produces: README yang menyatakan dukungan Desktop, guard test yang melarang klaim lama dan tetap melarang kredensial nyata.

- [x] **Step 1: Tulis test README yang gagal**

Tambahkan test berikut ke `test/readme.test.ts`:

```ts
it("mendokumentasikan dukungan slash command di Desktop", () => {
  expect(readme).toContain("Terminal vs Desktop");
  expect(readme).toMatch(/Desktop.{0,80}slash command/s);
  expect(readme).not.toContain("tidak akan muncul di Desktop");
  expect(readme).toContain("./gui-experimental");
});
```

Biarkan test lama `mendokumentasikan batasan TUI terminal vs Desktop` apa adanya (masih memeriksa `Terminal vs Desktop`, `./gui-experimental`, `tanpa \`--standalone\``, dan `OpenCode Desktop`) — kalimatnya akan diperbarui tanpa mengubah keempat token itu.

- [x] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test -- test/readme.test.ts`
Expected: FAIL — test baru menemukan kalimat lama "tidak akan muncul di Desktop".

- [x] **Step 3: Perbarui README**

Pada bagian `### Terminal vs Desktop`, ganti paragraf yang menyatakan `/asya-connect` tidak akan muncul di Desktop dengan kalimat yang diawali persis: `OpenCode Desktop sekarang mendukung ketiga slash command di atas lewat composer.` Lanjutkan dengan penjelasan: export `./gui-experimental` yang menyediakannya; kode tetap diminta lewat dialog dengan input tersembunyi; terminal `opencode` tanpa `--standalone` tetap didukung dan memakai service yang sama.

Perbarui daftar alur: Desktop bisa enroll/rotasi/status langsung, lalu memakai tool `asya_list_recent_journals`; terminal tetap alternatif.

Pada entri troubleshooting "Autocomplete `/asya-connect` tidak muncul di OpenCode Desktop", ganti isinya: pastikan paket sudah di-update ke versi yang mengekspor `./gui-experimental` (`opencode plugin update github:AMETORY/asya-mcp-plugin`), lalu restart Desktop; bila masih tidak muncul, cek log `failed to load plugin`. Jangan menuliskan kode enrollasi contoh.

- [x] **Step 4: Jalankan test README sampai lolos**

Run: `npm test -- test/readme.test.ts`
Expected: PASS — 12 test (11 lama + 1 baru).

- [x] **Step 5: Verifikasi seluruh perubahan**

Run (jalankan ketiganya):

```bash
npm test
npx tsc --noEmit
git diff --check
```

Expected: `npm test` semua file lolos; `npx tsc --noEmit` tanpa output; `git diff --check` tanpa output.

- [x] **Step 6: Commit Task 2**

```bash
git add README.md test/readme.test.ts
git commit -m "docs: perbarui panduan slash command Desktop asya-core"
```

## Catatan eksekusi

Setelah Task 2, perubahan baru aktif di Desktop hanya setelah: commit → push ke `github:AMETORY/asya-mcp-plugin` → `opencode plugin update github:AMETORY/asya-mcp-plugin` → restart Desktop. Push memerlukan izin eksplisit terpisah dari user.
