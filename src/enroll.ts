// Enrollment API client — konsumen endpoint Task 2: POST <functionsPath>/enroll.
// Secret (plain token) hanya muncul di respon enroll; plugin tidak pernah
// menyimpan kode atau token ke log/file.

export interface EnrollResponse {
  token: string;
  name: string;
  token_type: string;
  feature_keys: string[];
  expires_at: string | null;
  organization_id: string;
}

export interface EnrollOptions {
  url: string;
  functionsPath: string;
}

const CODE_PATTERN = /^[A-Z2-9]{8}$/;

export async function enroll(
  code: string,
  options: EnrollOptions,
): Promise<EnrollResponse> {
  const trimmed = code.trim();
  if (!CODE_PATTERN.test(trimmed)) {
    throw new Error("Kode enrollasi tidak valid: harus 8 karakter [A-Z2-9].");
  }
  const response = await fetch(`${options.url}${options.functionsPath}/enroll`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ code: trimmed }),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const message = detail?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Enroll gagal: ${message}`);
  }
  return (await response.json()) as EnrollResponse;
}
