# Repo Publik asya-mcp-plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memindahkan plugin OpenCode `opencode-asya-mcp` keluar dari `asya-core` ke repo publik mandiri yang bisa dipasang lewat `github:AMETORY/asya-mcp-plugin`, lengkap dengan README instalasi/konfigurasi, lalu mengarahkan config OpenCode ke alamat tersebut.

**Architecture:** Repo baru berisi sumber plugin apa adanya, test guard, dan README. Core hanya kehilangan direktori plugin dan test lama; tidak ada logika aplikasi yang diubah. Config global OpenCode diganti dari path relatif yang ENOENT menjadi git package setelah repo tersedia di GitHub.

**Tech Stack:** OpenCode V2 plugin API (`@opencode/plugin`), TypeScript 5.8, Vitest 4, git.

**Spec:** `docs/superpowers/specs/2026-11-23-asya-mcp-plugin-repo-design.md` (repo baru) dan `docs/superpowers/specs/2026-11-22-organization-api-token-design.md` (core, sebagai konteks).

## Global Constraints

- Format plugin OpenCode V2: `Plugin.define`, dependency `@opencode/plugin`.
- Nama package tetap `opencode-asya-mcp`.
- Path relatif di `plugins` di-resolve dari file config yang memuatnya — hindari path relatif.
- Bahasa dokumen dan output: Bahasa Indonesia.
- `SUPABASE_ACCESS_TOKEN` tidak tersedia; deploy/push manual oleh pengguna.
- Tidak ada push/publish/deploy tanpa instruksi eksplisit.
- Tidak menyimpan plain token, kode enrollasi, atau secret di repo/config/chat/config.
- Remote repo baru: `git@github.com:AMETORY/asya-mcp-plugin.git`.
- Core wajib mencatat perubahan di `docs/v1-changelog.md` (AGENTS.md).
- Endpoint `/mcp` masih 404 dan bukan bagian dari plan ini.

## Review Focus

- `options.url` kosong → setup plugin harus melempar error yang menyebut `url`, bukan gagal diam-diam. Test: Task 1, "url wajib".
- Kode enrollasi bukan 8 karakter `[A-Z2-9]` → perintah menolak sebelum `fetch`. Test: Task 1, "validasi kode enroll".
- Token/kode enrollasi bocor ke `ctx.storage` atau `console.log` → harus tidak ada. Test: Task 1, "token tidak masuk storage atau log".
- README memakai path relatif lama → pengguna dapat ENOENT. Test: Task 2, "alamat repo publik".
- README menjanjikan tool MCP yang belum ada dan tidak menyebut aturan token → pengguna menemui 404 tanpa petunjuk. Test: Task 2, "jujur soal endpoint dan token".

---

### Task 1: Scaffold repo baru dan pindahkan sumber plugin

**Files:**
- Create: `asya-mcp-plugin/package.json`
- Create: `asya-mcp-plugin/tsconfig.json`
- Create: `asya-mcp-plugin/src/index.ts`
- Create: `asya-mcp-plugin/src/enroll.ts`
- Create: `asya-mcp-plugin/.gitignore`
- Create: `asya-mcp-plugin/LICENSE`
- Test: `asya-mcp-plugin/test/source.test.ts`

**Interfaces:**
- Consumes: 5 file di `asisten-akuntansi-ai/plugins/opencode-asya-mcp/` (sumber, belum dihapus di Task 3).
- Produces: paket `opencode-asya-mcp` di repo baru dengan `exports["."] = "./src/index.ts"`; `npm test` dan `npx tsc --noEmit` bisa dijalankan di repo baru.

- [ ] **Step 1: Tulis test yang gagal**

`asya-mcp-plugin/test/source.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("package.json", () => {
  it("nama, dependency, dan exports sesuai desain", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.name).toBe("opencode-asya-mcp");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies["@opencode/plugin"]).toBeDefined();
    expect(pkg.exports["."]).toBe("./src/index.ts");
  });
});

describe("sumber plugin", () => {
  const src = read("src/index.ts");
  const enrollSrc = read("src/enroll.ts");

  it("url wajib", () => {
    expect(src).toContain("Plugin asya-mcp butuh opsi `url`");
  });

  it("validasi kode enroll sebelum fetch", () => {
    expect(src).toContain("ENROLL_CODE_PATTERN.exec");
    expect(src).toContain("Kode enrollasi tidak ditemukan");
    expect(enrollSrc).toContain("^[A-Z2-9]{8}$");
  });

  it("token tidak masuk storage atau log", () => {
    expect(src).not.toMatch(/console\.log\([^)]*token/);
    expect(src).toContain("ctx.integration.connect.key");
    const m = src.match(/ctx\.storage\.set\(\s*['"]asya-mcp['"],\s*\{([\s\S]*?)\}\s*\)/);
    expect(m).not.toBeNull();
    if (m) {
      expect(m[1]).not.toMatch(/\btoken\s*:/);
      expect(m[1]).not.toContain("enrollmentCode");
      expect(m[1]).toContain("tokenPrefix");
    }
  });

  it("enroll memakai POST /enroll", () => {
    expect(enrollSrc).toContain("/enroll");
    expect(enrollSrc).toContain("JSON.stringify({ code");
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd /Users/ametsuramet/AMETORY/PRODUCT/asya-mcp-plugin && npx --yes vitest@4.1.5 run test/source.test.ts`
Expected: FAIL dengan `ENOENT` karena file sumber belum ada.

- [ ] **Step 3: Salin sumber plugin**

Salin apa adanya: `src/index.ts`, `src/enroll.ts`, `tsconfig.json` dari `asisten-akuntansi-ai/plugins/opencode-asya-mcp/`.

- [ ] **Step 4: Tulis manifest, ignore, dan lisensi**

`package.json`:

```json
{
  "name": "opencode-asya-mcp",
  "version": "0.1.0",
  "private": false,
  "description": "OpenCode plugin: enroll bearer token ASYA MCP via kode sekali pakai.",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "files": ["src", "README.md", "LICENSE"],
  "scripts": { "test": "vitest run" },
  "dependencies": { "@opencode/plugin": "latest" },
  "devDependencies": { "typescript": "^5.8.3", "vitest": "^4.1.5" }
}
```

`.gitignore`: `node_modules/`, `dist/`, `*.log`, `.DS_Store`.
`LICENSE`: MIT, copyright `AMETORY 2026`.

- [ ] **Step 5: Install dependency dan jalankan test sampai lulus**

Run:
```bash
cd /Users/ametsuramet/AMETORY/PRODUCT/asya-mcp-plugin
npm install
npm test
npx tsc --noEmit
```
Expected: `npm test` PASS (5 test), `npx tsc --noEmit` exit 0.

- [ ] **Step 6: Inisialisasi git lokal dan commit**

```bash
git init -b main
git remote add origin git@github.com:AMETORY/asya-mcp-plugin.git
git add .
git commit -m "feat: ekstrak plugin opencode-asya-mcp ke repo mandiri"
```
Expected: commit dibuat. **Jangan push.**

---

### Task 2: README instalasi dan konfigurasi

**Files:**
- Create: `asya-mcp-plugin/README.md`
- Test: `asya-mcp-plugin/test/readme.test.ts`

**Interfaces:**
- Consumes: package name `opencode-asya-mcp`, opsi `url`/`functionsPath`/`serverName`/`mcpUrl` dari `src/index.ts`.
- Produces: README yang bisa dipakai orang lain tanpa membaca source.

- [ ] **Step 1: Tulis test yang gagal**

`asya-mcp-plugin/test/readme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");

describe("README instalasi", () => {
  it("alamat repo publik, bukan path relatif", () => {
    expect(readme).toContain("github:AMETORY/asya-mcp-plugin");
    expect(readme).not.toContain("./plugins/opencode-asya-mcp");
  });

  it("contoh config memuat options.url wajib", () => {
    expect(readme).toContain("opencode.jsonc");
    expect(readme).toContain("options");
    expect(readme).toContain('"url"');
  });

  it("mendokumentasikan perintah dan tool", () => {
    for (const name of ["/asya-connect", "/asya-rotate-token", "/asya-status", "asya_status"]) {
      expect(readme).toContain(name);
    }
  });

  it("jujur soal endpoint /mcp dan aturan token", () => {
    expect(readme).toMatch(/404/);
    expect(readme).toMatch(/token/i);
    expect(readme).toMatch(/tidak ditaruh/i);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd /Users/ametsuramet/AMETORY/PRODUCT/asya-mcp-plugin && npm test -- test/readme.test.ts`
Expected: FAIL dengan `ENOENT` karena README belum ditulis.

- [ ] **Step 3: Tulis README**

`README.md` berisi, berurutan: judul; prasyarat (proyek dengan `opencode.jsonc`, token dibuat dari OrganizationForm di ASYA); install lewat entri `plugins` dengan `"package": "github:AMETORY/asya-mcp-plugin"` dan `"options": { "url": "https://<project>.supabase.co/functions/v1" }` (nyatakan `url` wajib); penjelasan bahwa `functionsPath` default `/functions/v1/asya-mcp`, `serverName` default `asya-core`; tiga perintah beserta argumen kode 8 karakter; tool `asya_status`; aturan keamanan bahwa plain token dan kode enrollasi **tidak ditaruh** di `opencode.jsonc`, chat, skill, atau log; troubleshoot `MCP_TOKEN_ENCRYPTION_KEY` (32-byte base64url tanpa padding); dan catatan bahwa tool MCP belum bisa dipanggil karena endpoint `/mcp` mengembalikan 404.

Gunakan Bahasa Indonesia. Jangan memasukkan kunci, token, atau kode enrollasi contoh yang bisa disalahartikan sebagai secret.

- [ ] **Step 4: Jalankan seluruh test sampai lulus**

Run: `cd /Users/ametsuramet/AMETORY/PRODUCT/asya-mcp-plugin && npm test`
Expected: PASS (9 test dari Task 1 dan Task 2).

- [ ] **Step 5: Commit**

```bash
git add README.md test/readme.test.ts
git commit -m "docs: tambah README instalasi dan konfigurasi plugin"
```

---

### Task 3: Bersihkan core dan catat perubahan

**Files:**
- Delete: `asisten-akuntansi-ai/plugins/opencode-asya-mcp/` (5 file)
- Delete: `asisten-akuntansi-ai/src/test/opencodeAsyaMcpPlugin.test.ts`
- Modify: `asisten-akuntansi-ai/docs/v1-changelog.md`
- Modify: `asisten-akuntansi-ai/docs/superpowers/specs/2026-11-22-organization-api-token-design.md`
- Test: `asisten-akuntansi-ai/src/test/asyaCorePluginRemoved.test.ts`

**Interfaces:**
- Consumes: hasil Task 1 dan Task 2 (repo baru sudah punya sumber + README).
- Produces: core tanpa file plugin; changelog dan spec lama menunjuk repo publik.

- [ ] **Step 1: Tulis test yang gagal**

`asisten-akuntansi-ai/src/test/asyaCorePluginRemoved.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("plugin OpenCode tidak lagi di core", () => {
  it("direktori plugin lama tidak ada", () => {
    expect(existsSync(resolve(root, "plugins", "opencode-asya-mcp"))).toBe(false);
  });
  it("test plugin lama tidak ada", () => {
    expect(existsSync(resolve(root, "src", "test", "opencodeAsyaMcpPlugin.test.ts"))).toBe(false);
  });
  it("changelog menunjuk repo publik", () => {
    const log = readFileSync(resolve(root, "docs", "v1-changelog.md"), "utf8");
    expect(log).toContain("asya-mcp-plugin");
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd /Users/ametsuramet/AMETORY/PRODUCT/asisten-akuntansi-ai && npx vitest run src/test/asyaCorePluginRemoved.test.ts`
Expected: FAIL karena direktori plugin masih ada.

- [ ] **Step 3: Hapus file plugin lama dari core**

Hapus direktori `plugins/opencode-asya-mcp/` dan file `src/test/opencodeAsyaMcpPlugin.test.ts`.

- [ ] **Step 4: Tambah entri changelog core**

Tambah entri teratas di bagian modul `[Pengaturan Organisasi & COA]` pada `docs/v1-changelog.md` dengan format `### 2026-11-23 — ...`, berisi: apa yang berubah (plugin dipindah ke repo publik `github:AMETORY/asya-mcp-plugin`), file terkait, keputusan (nama package tetap `opencode-asya-mcp`, test guard ikut dipindah), dan gotcha (path relatif plugin di config global ENOENT; `/mcp` masih 404; jangan simpan token di config). Jangan hapus entri lama.

- [ ] **Step 5: Tambah catatan status di spec lama**

Tambah satu baris catatan status dekat `Package baru plugins/opencode-asya-mcp/` di `docs/superpowers/specs/2026-11-22-organization-api-token-design.md` bahwa plugin telah dipindah ke repo publik `asya-mcp-plugin`.

- [ ] **Step 6: Verifikasi core**

Run:
```bash
cd /Users/ametsuramet/AMETORY/PRODUCT/asisten-akuntansi-ai
npx vitest run src/test/asyaCorePluginRemoved.test.ts
npx tsc --noEmit 2>&1 | tail -3
git diff --check
node .gitnexus/run.cjs detect-changes --scope all --repo . 2>&1 | tail -5
```
Expected: test PASS; `tsc` tetap 63 error baseline dan tidak ada error baru; `git diff --check` exit 0; `detect-changes` exit 0 tanpa `partial: true` atau `truncated: true`.

Jalankan juga `graphify update .`. Expected di mesin ini: gagal dengan `Graph has 6269 nodes - too large for HTML viz` — ini limitation yang sudah diketahui, bukan regresi. Jika meninggalkan perubahan sebagian di `graphify-out/`, kembalikan dengan `git restore graphify-out`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: pindahkan plugin OpenCode ke repo publik asya-mcp-plugin"
```
Expected: commit dibuat di `main`. Jangan push.

---

### Task 4: Arahkan config global OpenCode

**Files:**
- Modify: `/Users/ametsuramet/.config/opencode/opencode.json` (di luar git; tidak ada commit)

**Interfaces:**
- Consumes: repo publik `github:AMETORY/asya-mcp-plugin` sudah tersedia di GitHub (dibuat dan dipush oleh pengguna — tidak oleh agent).
- Produces: `/asya-connect`, `/asya-rotate-token`, `/asya-status`, dan tool `asya_status` bisa dimuat OpenCode.

- [ ] **Step 1: Ganti entri plugin**

Di `plugins`, ubah objek plugin lama:
```jsonc
{ "package": "./plugins/opencode-asya-mcp", "options": { "url": "https://robrebioyfquemukodze.supabase.co/functions/v1" } }
```
menjadi:
```jsonc
{ "package": "github:AMETORY/asya-mcp-plugin", "options": { "url": "https://robrebioyfquemukodze.supabase.co/functions/v1" } }
```
Biarkan entri plugin lain (`cavemem-capture`, `superpowers`) apa adanya. Jangan menambah field token.

- [ ] **Step 2: Verifikasi isi config tanpa menampilkan secret**

Run:
```bash
node -e '
const fs=require("fs");
const p="/Users/ametsuramet/.config/opencode/opencode.json";
const c=JSON.parse(fs.readFileSync(p,"utf8"));
const e=(c.plugins||[]).find(x=>typeof x==="object" && JSON.stringify(x).includes("asya-mcp"));
if(!e) throw new Error("entri plugin tidak ada");
if(e.package!=="github:AMETORY/asya-mcp-plugin") throw new Error("package salah");
if(!e.options||e.options.url!=="https://robrebioyfquemukodze.supabase.co/functions/v1") throw new Error("url hilang");
console.log("CONFIG_OK");
'
```
Expected: `CONFIG_OK`.

- [ ] **Step 3: Serahkan langkah runtime ke pengguna**

Minta pengguna menjalankan `/reload` di OpenCode setelah repo tersedia di GitHub, lalu `/asya-status`. Jangan menjalankan `/asya-connect` tanpa kode enrollasi dari pengguna, dan jangan meminta kode itu dikirim ke chat.

- [ ] **Step 4: Verifikasi fondasi runtime yang masih terbuka**

Catat sebagai belum terverifikasi: M6 (`editor.update` registrasi integration) dan pemanggilan tool MCP nyata (endpoint `/mcp` masih 404). Jangan mengklaim tool MCP berfungsi.
