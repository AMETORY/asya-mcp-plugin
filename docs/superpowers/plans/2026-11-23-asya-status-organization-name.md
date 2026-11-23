# Nama Organisasi di `/asya-status` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notifikasi `/asya-status` menampilkan nama organisasi, bukan UUID.

**Architecture:** Plugin server memanggil tool MCP `asya_get_active_organization` lewat JSON-RPC langsung dengan token in-memory, lalu menaruh `organizationName` sebagai field opsional pada output RPC `status`. TUI dan GUI memakai nama itu dengan fallback ke `organizationId`. Tidak ada perubahan pada edge function core.

**Tech Stack:** TypeScript, Vitest, RPC plugin OpenCode, SSE JSON-RPC over HTTPS, esbuild (`npm run build:gui`).

**Spec:** `docs/superpowers/specs/2026-11-23-asya-status-organization-name-design.md`

## Global Constraints

- Token dan kode enrollasi tidak boleh masuk `ctx.storage`, config, source, log, atau respons tool/RPC.
- Slash command yang valid hanya `/asya-connect`, `/asya-rotate-token`, `/asya-status`.
- Jangan menimpa entri MCP `asya-core` hasil `opencode mcp add` / OAuth.
- Semua teks UI berbahasa Indonesia.
- `prebuilt/gui.cjs` wajib di-build ulang setelah mengubah `src/gui.ts`.

## Review Focus

- Respons SSE dengan beberapa baris `data:` atau payload bukan JSON → `null`, bukan exception. Diuji Task 1.
- HTTP 401/500 atau `fetch` reject → `status` tetap `connected: true`, fallback ke UUID. Diuji Task 2.
- Token tidak boleh muncul di nilai kembalian, storage, atau pesan error. Diuji Task 1 & 2.
- Metadata lama tanpa `organizationName` → tetap menampilkan nama hasil resolve, bukan `undefined`. Diuji Task 2 & 3.
- Bundle Desktop hanya boleh `require` dua modul `@opencode/plugin` bersama, dan memuat perubahan GUI. Diuji Task 3.

---

### Task 1: Resolver nama organisasi

**Files:**
- Create: `src/organization.ts`
- Test: `test/organization.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveOrganizationName(mcpUrl: string, token: string): Promise<string | null>` — `null` bila gagal atau nama tidak ada.

- [ ] **Step 1: Tulis test yang gagal**

`test/organization.test.ts`: stub `fetch` global; assertion:
  - SSE `data: {"result":{"content":[{"type":"text","text":"{\"organization_id\":\"org-1\",\"name\":\"Demo Company\"}"}]},"jsonrpc":"2.0","id":2}` → `"Demo Company"`.
  - SSE dengan baris `event: message` + `data:` + baris `data:` kedua → tetap `"Demo Company"`.
  - `fetch` resolve status 500 → `null`.
  - `fetch` reject → `null`.
  - Header request mengandung `Authorization: Bearer <token>` dan nilai kembalian tidak mengandung token.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test -- --run test/organization.test.ts`
Expected: FAIL (`Cannot find module src/organization.ts`).

- [ ] **Step 3: Implementasi `resolveOrganizationName`**

`src/organization.ts`: POST JSON-RPC 2.0 `tools/call` ke `mcpUrl` dengan method `tools/call`, params `{ name: "asya_get_active_organization", arguments: {} }`, header `Content-Type: application/json`, `Accept: application/json, text/event-stream`, `Authorization: Bearer ${token}`. Parse setiap baris response yang diawali `data: `, `JSON.parse`, ambil `result.content` (array), cari entri `type === "text"`, `JSON.parse` field `text`, kembalikan `name` bila string. `catch` → `null`. Gunakan `AbortSignal.timeout(5000)` bila tersedia. Jangan mencatat token atau body mentah.

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npm test -- --run test/organization.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/organization.ts test/organization.test.ts
git commit -m "feat: resolver nama organisasi asya via tool MCP"
```

### Task 2: Field `organizationName` pada RPC `status`

**Files:**
- Modify: `src/rpc.ts`, `src/index.ts`, `test/rpcFeedback.test.ts`

**Interfaces:**
- Consumes: `resolveOrganizationName(mcpUrl, token)` dari Task 1.
- Produces: `status()` mengembalikan `{ connected: true, ..., organizationName?: string }`; `AsyaMetadata.organizationName?: string`.

- [ ] **Step 1: Tulis test yang gagal**

Tambah kasus di `test/rpcFeedback.test.ts` dengan harness `makeHarness()` yang sudah ada:
  - storage berisi metadata lama tanpa `organizationName`; stub `fetch` mengembalikan SSE nama `"Demo Company"`; panggil `status()` → `organizationName === "Demo Company"`.
  - stub `fetch` reject; panggil `status()` → `connected === true`, `organizationName === undefined`, `organizationId === "org-123"` (fallback UUID).
  - setelah `status`, storage tidak mengandung token.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test -- --run test/rpcFeedback.test.ts`
Expected: FAIL (`organizationName` tidak ada di output).

- [ ] **Step 3: Implementasi**

`src/rpc.ts`: tambahkan `organizationName: { type: "string" }` ke `metadataProperties` dan `organizationName?: string` ke `AsyaMetadata` (tetap opsional; `statusOutput` mewarisi via spread).
`src/index.ts`: import resolver; di handler `status`, bila `token` ada panggil `resolveOrganizationName(mcpUrl, token)`, gabungkan hasilnya dengan `metadata` (prioritas: hasil resolve → `metadata.organizationName` → tanpa field), simpan ke `metadata` dan `ctx.storage.set("asya-mcp", ...)`. Di `enrollCommand`, isi `organizationName` dari resolver setelah enroll (abaikan kegagalan).

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npm test -- --run test/rpcFeedback.test.ts && npx tsc --noEmit`
Expected: PASS, tanpa error TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/rpc.ts src/index.ts test/rpcFeedback.test.ts
git commit -m "feat: sertakan nama organisasi pada status RPC asya"
```

### Task 3: Tampilkan nama di TUI & GUI

**Files:**
- Modify: `src/tui.ts`, `src/gui.ts`, `test/asyaStatus.test.ts`, `prebuilt/gui.cjs`

**Interfaces:**
- Consumes: `organizationName` dari `status()` Task 2.
- Produces: toast sukses menampilkan `Terhubung: <name> (organisasi <organizationName ?? organizationId>).`

- [ ] **Step 1: Tulis test yang gagal**

`test/asyaStatus.test.ts`: tambah dua assertion:
  - RPC `status` mengembalikan `organizationName: "Demo Company"` → `toasts[0].message` mengandung `"organisasi Demo Company"` dan tidak mengandung UUID.
  - RPC tanpa `organizationName` → `toasts[0].message` mengandung UUID (fallback).

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test -- --run test/asyaStatus.test.ts`
Expected: FAIL (toast masih memakai UUID).

- [ ] **Step 3: Implementasi**

Di `src/tui.ts` dan `src/gui.ts`: perluas tipe `AsyaRpc.status` dengan `organizationName?: string`; ganti interpolated `result.organizationId` menjadi `result.organizationName ?? result.organizationId`. Jalankan `npm run build:gui` untuk memperbarui `prebuilt/gui.cjs`.

- [ ] **Step 4: Verifikasi penuh**

Run: `npx tsc --noEmit && npm test && npm run build:gui && git diff --check`
Expected: TypeScript bersih, 52 test lolos, bundle terbuat, diff bersih.

- [ ] **Step 5: Commit**

```bash
git add src/tui.ts src/gui.ts test/asyaStatus.test.ts prebuilt/gui.cjs
git commit -m "feat: tampilkan nama organisasi di notifikasi /asya-status"
```
