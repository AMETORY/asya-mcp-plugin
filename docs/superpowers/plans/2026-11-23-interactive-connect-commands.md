# Perintah connect interaktif via dialog TUI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memindahkan `/asya-connect`, `/asya-rotate-token`, dan `/asya-status` dari perintah chat server ke dialog/keymap TUI, dengan RPC sebagai jembatan ke kredensial server.

**Architecture:** Plugin tetap satu paket dengan tiga bagian: server (`.`) menyimpan kredensial dan mengeksekusi enroll, RPC (`./rpc`) mendefinisikan kontrak metadata-only, TUI (`./tui`) meminta kode lewat `dialog.prompt()` lalu memanggil `context.client.rpc(Asya)`. Token tidak pernah melintas ke TUI.

**Tech Stack:** TypeScript, `@opencode/plugin@2.3.2` (`@opencode/plugin/tui`, `@opencode/plugin/rpc`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-interactive-connect-commands-design.md`

## Global Constraints

- Kode enrollasi dan token TIDAK boleh masuk chat, `ctx.storage`, source, config, atau log.
- RPC hanya mengembalikan metadata: `name`, `organizationId`, `enrolledAt`, `tokenPrefix`, `connected`.
- Kode enrollasi: tepat 8 karakter `[A-Z2-9]`; validasi dilakukan di TUI **dan** di server.
- Perintah server `asya-connect`, `asya-rotate-token`, `asya-status` dihapus; tool `asya_status` tetap.
- Bahasa pesan UI dan test: Bahasa Indonesia.
- Jangan commit perubahan migrasi/SQL/endpoint; repo ini hanya plugin.
- Jangan push tanpa instruksi eksplisit.

## Review Focus

- **Kode salah ketik di dialog** → TUI menolak sebelum RPC; test: `isValidEnrollCode` di `test/enroll.test.ts`.
- **User menekan Escape / cancel** → tidak ada RPC, tidak ada toast error; test: source guard TUI memastikan `if (!code` sebelum `context.client.rpc`.
- **Enroll gagal di server** → error RPC berisi pesan server, bukan token; test: `rpcFeedback.test.ts` kasus HTTP 400.
- **Status sebelum enroll** → `{ connected: false }`, bukan metadata kosong yang menyesatkan; test: `rpcFeedback.test.ts` kasus status awal.
- **Server restart mengganti client** → `context.client.rpc(Asya)` dibaca di dalam `run`; test: source guard TUI.
- **Token bocor lewat RPC output** → schema output tidak punya properti `token`/`code`; test: `source.test.ts`.

---

### Task 1: Kontrak RPC dan helper validasi kode

**Files:**
- Create: `src/rpc.ts`
- Modify: `src/enroll.ts`
- Test: `test/enroll.test.ts`, `test/rpc.test.ts` (baru)

**Interfaces:**
- Consumes: `CODE_PATTERN` dari `src/enroll.ts` (sudah ada).
- Produces: `Asya` (`Rpc.define`), `AsyaMetadata = { name; organizationId; enrolledAt; tokenPrefix }`, `isValidEnrollCode(code: string): boolean`.

- [ ] **Step 1: Tulis test gagal untuk `isValidEnrollCode` di `test/enroll.test.ts`**

```ts
import { isValidEnrollCode } from "../src/enroll.ts";

it("menerima kode 8 karakter [A-Z2-9] dan menolak yang lain", () => {
  expect(isValidEnrollCode("ABCDEFG2")).toBe(true);
  expect(isValidEnrollCode(" ABCDEFG2 ")).toBe(true);
  expect(isValidEnrollCode("abcdefg2")).toBe(false);
  expect(isValidEnrollCode("ABCDEFG1")).toBe(false); // digit 1 dilarang
  expect(isValidEnrollCode("ABCDEFG")).toBe(false);
  expect(isValidEnrollCode("")).toBe(false);
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test -- test/enroll.test.ts`
Expected: FAIL — `isValidEnrollCode is not a function`.

- [ ] **Step 3: Ekspor helper di `src/enroll.ts`**

Tambahkan `export function isValidEnrollCode(code: string): boolean` yang memakai `CODE_PATTERN.test(code.trim())`. Jangan ubah `extractEnrollCode`.

- [ ] **Step 4: Tulis test gagal untuk bentuk kontrak RPC di `test/rpc.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { Asya } from "../src/rpc.ts";

describe("kontrak RPC asya", () => {
  it("mendefinisikan connect, rotate, dan status", () => {
    expect(Object.keys(Asya.methods).sort()).toEqual(["connect", "rotate", "status"]);
  });

  it("output connect/rotate tidak mengandung token maupun code", () => {
    for (const name of ["connect", "rotate"] as const) {
      const out = Asya.methods[name].output as { properties: Record<string, unknown> };
      expect(Object.keys(out.properties).sort()).toEqual(
        ["enrolledAt", "name", "organizationId", "tokenPrefix"],
      );
    }
  });
});
```

- [ ] **Step 5: Jalankan test untuk memastikan gagal**

Run: `npm test -- test/rpc.test.ts`
Expected: FAIL — cannot resolve `../src/rpc.ts`.

- [ ] **Step 6: Buat `src/rpc.ts`**

```ts
import { Rpc } from "@opencode/plugin/rpc";

export type AsyaMetadata = {
  name: string;
  organizationId: string;
  enrolledAt: string;
  tokenPrefix: string;
};

export const Asya = Rpc.define({ /* id: "asya", methods: connect, rotate, status */ });
```

Isi `connect` dan `rotate`: `input` JSON Schema `{ code: string }` dengan `required: ["code"]`, `additionalProperties: false`; `output` JSON Schema dengan keempat properti `AsyaMetadata` (semua `required`). Isi `status`: tanpa `input`; `output` dengan `connected: boolean` (wajib) + keempat metadata (opsional). Tanpa `errors`, tanpa `events`.

- [ ] **Step 7: Jalankan test Task 1**

Run: `npm test -- test/enroll.test.ts test/rpc.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/rpc.ts src/enroll.ts test/enroll.test.ts test/rpc.test.ts
git commit -m "feat: tambah kontrak RPC metadata-only dan validasi kode enrollasi"
```

---

### Task 2: Server mengeksekusi enroll lewat RPC

**Files:**
- Modify: `src/index.ts`
- Delete: `test/commandFeedback.test.ts`
- Test: `test/rpcFeedback.test.ts` (baru)

**Interfaces:**
- Consumes: `Asya`, `AsyaMetadata` dari Task 1; `extractEnrollCode`, `enroll`, `resolveOptions` yang sudah ada.
- Produces: `ctx.rpc.register(Asya, handlers)` dengan handler `connect`, `rotate`, `status`; tidak ada lagi `ctx.command.transform`.

- [ ] **Step 1: Tulis test gagal untuk handler RPC di `test/rpcFeedback.test.ts`**

Harness: `ctx` berisi `options`, `storage` (Map), `integration.transform/connect.key/connection`, `mcp.transform/reload`, `tool.transform`, dan `rpc.register: vi.fn(async (_def, handlers) => { registered = handlers; return { dispose: vi.fn() }; })`. Stub `fetch` dengan response `{ token: "asya_mcp_SECRETVALUE", name: "token uji", ... }`. Panggil `await plugin.setup(ctx)` lalu `registered.connect({ code: "ABCDEFG2" })`.

Enam test dengan assertion:
1. `connect` mengembalikan `{ name: "token uji", organizationId: "org-123", tokenPrefix: expect.any(String), enrolledAt: expect.any(String) }` dan **tidak** punya key `token`/`code`.
2. `connect` memanggil `integration.connect.key` dengan `"asya_mcp_SECRETVALUE"` dan `mcp.reload`.
3. `rotate` mengembalikan metadata yang sama.
4. `status` sebelum enroll → `{ connected: false }`; setelah enroll → `connected: true` + metadata.
5. Enroll HTTP 400 → `rejects.toThrow("Enroll gagal: Kode tidak valid")`, pesan error tidak mengandung `"asya_mcp_SECRETVALUE"`.
6. `connect({ code: "salah" })` → `rejects.toThrow("Kode enrollasi tidak ditemukan")` dan `fetch` tidak dipanggil.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test -- test/rpcFeedback.test.ts`
Expected: FAIL — `registered` tetap undefined karena `index.ts` belum memanggil `ctx.rpc.register`.

- [ ] **Step 3: Refactor `src/index.ts`**

- Import `Asya`, `type AsyaMetadata` dari `./rpc.ts`.
- Ubah `enrollCommand(prompt: {text?: string})` menjadi `enrollCommand(code: string): Promise<AsyaMetadata>`; tetap pakai `extractEnrollCode(code)` dengan pesan `"Kode enrollasi tidak ditemukan (8 karakter [A-Z2-9] di argumen perintah)."` — ubah Kalimatnya menjadi `"Kode enrollasi tidak ditemukan (8 karakter [A-Z2-9])."`.
- Simpan metadata internal seperti sekarang (`McpMetadata` termasuk `serverName`), kembalikan hanya `AsyaMetadata` tanpa `serverName`.
- Daftarkan handler:

```ts
await ctx.rpc.register(Asya, {
  connect: async (input) => enrollCommand((input as { code: string }).code),
  rotate: async (input) => enrollCommand((input as { code: string }).code),
  status: async () => metadata
    ? { connected: true, name: metadata.name, organizationId: metadata.organizationId,
        enrolledAt: metadata.enrolledAt, tokenPrefix: metadata.tokenPrefix }
    : { connected: false },
});
```

- Hapus seluruh blok `ctx.command.transform(...)` dan semua pemakaian `ctx.session.synthetic`.
- Biarkan `ctx.tool.transform`, `ctx.integration.transform`, `applyMcp()`, dan blok resolusi kredensial saat startup apa adanya.

- [ ] **Step 4: Jalankan test Task 2**

Run: `npm test -- test/rpcFeedback.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Commit**

```bash
git add src/index.ts test/rpcFeedback.test.ts test/commandFeedback.test.ts
git commit -m "refactor: pindahkan enroll asya-core ke handler RPC"
```

---

### Task 3: Bagian TUI, export paket, dan penjaga sumber

**Files:**
- Create: `src/tui.ts`
- Modify: `package.json`, `test/source.test.ts`, `test/readme.test.ts`, `README.md`

**Interfaces:**
- Consumes: `Asya`, `AsyaMetadata` dari Task 1; `isValidEnrollCode` dari Task 1.
- Produces: `src/tui.ts` dengan tiga slash command TUI; export `./tui` dan `./rpc` di `package.json`.

- [ ] **Step 1: Tulis test gagal untuk export dan sumber TUI di `test/source.test.ts`**

Tambah assertion:
- `pkg.exports["./tui"] === "./src/tui.ts"`, `pkg.exports["./rpc"] === "./src/rpc.ts"`.
- `src` (index.ts) **tidak** mengandung `ctx.command.transform` maupun `synthetic(`; **mengandung** `ctx.rpc.register(Asya`.
- `read("src/tui.ts")` mengandung `dialog.prompt`, `context.client.rpc(Asya)`, dan `isValidEnrollCode(`; tidak mengandung `console.log` atau `integration.connect.key`.
- `read("src/rpc.ts")` tidak mengandung `token:` pada schema output.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test -- test/source.test.ts`
Expected: FAIL — export `./tui` belum ada, file `src/tui.ts` belum ada.

- [ ] **Step 3: Tambah export di `package.json`**

```json
"exports": {
  ".": "./src/index.ts",
  "./tui": "./src/tui.ts",
  "./rpc": "./src/rpc.ts"
}
```

Jangan tambah dependency/peerDependency baru.

- [ ] **Step 4: Buat `src/tui.ts`**

```ts
import { Plugin } from "@opencode/plugin/tui";
import { isValidEnrollCode } from "./enroll.ts";
import { Asya } from "./rpc.ts";
```

`Plugin.define({ id: "asya-mcp.tui", setup(context) { ... } })` dengan satu `context.keymap.layer(() => ({ mode: "global", commands: [...] }))`:

| id | title | slash.name | aksi |
|---|---|---|---|
| `asya.connect` | Hubungkan asya-core | `asya-connect` | dialog enroll |
| `asya.rotate` | Rotasi token asya-core | `asya-rotate-token` | dialog enroll |
| `asya.status` | Status asya-core | `asya-status` | RPC `status()` → toast |

Fungsi dialog enroll (async):
1. `const code = await context.ui.dialog.prompt({ title: "Kode enrollasi asya-core", description: "8 karakter [A-Z2-9], sekali pakai.", placeholder: "XXXXXXXX" })`.
2. Jika `!code` → return tanpa toast. Jika `!isValidEnrollCode(code)` → `toast.show({ message: "Kode harus 8 karakter [A-Z2-9].", variant: "error" })` lalu return.
3. `const result = await context.client.rpc(Asya)[method]({ code })` — baca `context.client` **di dalam** `run`, bukan di `setup`.
4. Success → `toast.show({ title: "asya-core", message: ..., variant: "success" })` dengan `result.name` + `result.organizationId` saja.
5. Catch → `toast.show({ title: "asya-core", message: error instanceof Error ? error.message : String(error), variant: "error" })`.

Fungsi status: panggil `context.client.rpc(Asya).status()`, tampilkan metadata via toast (`connected: false` → `"asya-core belum terenroll."`), error → toast error.

- [ ] **Step 5: Perbarui dokumentasi perintah yang sudah stale di `README.md`**

Ubah bagian perintah agar menyebut dialog TUI (bukan kode sebagai argumen chat). Pertahankan penyebutan `/asya-connect`, `/asya-rotate-token`, `/asya-status`, `asya_status`. Tambah kalimat bahwa kode diminta lewat dialog dan tidak masuk chat.

Sertakan pula **server default** persis ini di contoh konfigurasi instalasi dan di
parafrasa `url`:

```
https://robrebioyfquemukodze.supabase.co/functions/v1
```

Tuliskan sebagai nilai yang dipakai di ASYA produksi / nilai contoh siap pakai.
Opsi `url` tetap wajib diisi di kode — perubahan ini hanya dokumentasi, bukan
perubahan `resolveOptions`. **Jangan** menyentuh bagian cross-agent / kredensial lain.

- [ ] **Step 6: Tambah assertion README di `test/readme.test.ts`**

```ts
it("perintah enroll memakai dialog, bukan argumen chat", () => {
  expect(readme).toMatch(/dialog/i);
  expect(readme).toMatch(/kode enrollasi/i);
});
```

- [ ] **Step 7: Jalankan seluruh test**

Run: `npm test`
Expected: PASS (semua file).

- [ ] **Step 8: Commit**

```bash
git add src/tui.ts package.json test/source.test.ts test/readme.test.ts README.md
git commit -m "feat: dialog TUI untuk connect, rotate token, dan status asya-core"
```

---

### Task 4: Verifikasi akhir

**Files:** tidak ada perubahan kode.

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: PASS tanpa error.

- [ ] **Step 2: Test penuh**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Cek whitespace diff**

Run: `git diff --check`
Expected: tidak ada output.

- [ ] **Step 4: Pastikan tidak ada kebocoran kredensial di source**

Run: `grep -RInE 'asya_mcp_[A-Za-z0-9]{6,}|ABCDEFG2|SECRETVALUE' src test README.md || true`
Expected: hanya boleh muncul di file test sebagai nilai uji (`test/rpcFeedback.test.ts`, `test/enroll.test.ts`); tidak di `src/` atau `README.md`.

- [ ] **Step 5: Cek git status**

Run: `git status --short`
Expected: hanya design doc + plan yang belum ter-commit (milik task dokumentasi terpisah) bila belum di-commit; tidak ada file plugin yang terlewat.
