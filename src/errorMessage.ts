// Klien RPC OpenCode melempar error sebagai objek polos
// (`{ type, message }`), bukan instance `Error`. Tanpa penanganan ini,
// `String(error)` menampilkan "[object Object]" di toast.

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}
