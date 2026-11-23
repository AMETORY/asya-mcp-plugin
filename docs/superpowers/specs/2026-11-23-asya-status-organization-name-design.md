# Design: Nama Organisasi di Notifikasi `/asya-status`

## Intent
Notifikasi `/asya-status` saat ini menampilkan UUID organisasi. Pengguna ingin
nama organisasi yang mudah dibaca (mis. `Demo Company`).

## Goals
- `/asya-status` menampilkan nama organisasi dari akun yang terhubung.
- Tetap bekerja untuk kredensial lama tanpa enroll ulang.
- TokenPlain tidak pernah masuk storage, config, log, source, atau respons tool.

## Non-goals
- Mengubah tool MCP, edge function, atau schema Zod di repo core.
- Deploy produksi / perubahan secret.
- Mengganti format RPC selain menambah field opsional.

## Constraints
- Context plugin OpenCode tidak menyediakan pemanggilan tool MCP; satu-satunya
  jalur adalah JSON-RPC langsung ke `mcpUrl` dengan token in-memory.
- Endpoint `/mcp` membalas SSE (`event: message`, `data: {...}`).
- RPC `status` bersifat metadata-only.

## Approaches
- **A (dipilih):** resolve nama saat `status` lewat `tools/call`
  `asya_get_active_organization`, fallback ke UUID bila gagal. Tidak ada
  perubahan core/deploy; berlaku untuk kredensial existing.
- **B (ditolak):** kirim `organization_name` dari enroll API core → butuh
  deploy produksi dan enroll ulang agar token lama punya nama.
- **C (ditolak):** tampilkan nama + UUID; pengguna memilih nama saja.

## Design
1. `src/organization.ts` — `resolveOrganizationName(mcpUrl, token)`:
   POST JSON-RPC `tools/call` dengan header `Authorization: Bearer <token>`,
   parse baris `data:` SSE, baca `result.content[0].text` (JSON), kembalikan
   `name`. Timeout singkat; kegagalan → `null`. Tidak mencatat token/body mentah.
2. `src/rpc.ts` — tambah `organizationName?: string` ke `AsyaMetadata`,
   `metadataProperties`, dan `statusOutput` (semua opsional, backward-compatible).
3. `src/index.ts` — handler `status` memanggil resolver memakai `token` dan
   `mcpUrl`, menyimpan hasilnya ke metadata + storage non-secret; fallback ke
   `organizationId`. `connect`/`rotate` mengisi nama setelah enroll.
4. `src/tui.ts` & `src/gui.ts` — tampilkan `organizationName ?? organizationId`;
   build ulang `prebuilt/gui.cjs`.
5. Test — mock fetch untuk kasus sukses, SSE bundle, gagal/timeout, dan toast
   memakai nama (bukan UUID).
