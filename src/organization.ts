// Ambil nama organisasi aktif lewat tool MCP `asya_get_active_organization`.
// Token dipakai hanya sebagai header Bearer; tidak pernah dicatat atau
// dikembalikan. Kegagalan apa pun → null supaya pemanggil bisa fallback.

const TIMEOUT_MS = 5000;

type TextContent = { type?: string; text?: string };
type RpcMessage = {
  result?: { content?: TextContent[] };
};

function timeoutSignal(): AbortSignal | undefined {
  const factory = (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout;
  return typeof factory === "function" ? factory(TIMEOUT_MS) : undefined;
}

function nameFromMessage(message: RpcMessage): string | null {
  const content = message.result?.content;
  if (!Array.isArray(content)) return null;
  const text = content.find(
    (entry) => entry?.type === "text" && typeof entry.text === "string",
  )?.text;
  if (!text) return null;

  try {
    const payload = JSON.parse(text) as { name?: unknown };
    if (typeof payload.name !== "string") return null;
    return payload.name.trim() ? payload.name : null;
  } catch {
    return null;
  }
}

export async function resolveOrganizationName(
  mcpUrl: string,
  token: string,
): Promise<string | null> {
  try {
    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "asya_get_active_organization", arguments: {} },
      }),
      signal: timeoutSignal(),
    });
    if (!response.ok) return null;

    const body = await response.text();

    // Respons SSE (bentuk saat ini): event: message + data: {...}.
    for (const line of body.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;

      let message: RpcMessage;
      try {
        message = JSON.parse(data) as RpcMessage;
      } catch {
        continue;
      }
      const name = nameFromMessage(message);
      if (name) return name;
    }

    // Defensif: server bisa membalas JSON-RPC polos bila modus respons berubah.
    try {
      return nameFromMessage(JSON.parse(body) as RpcMessage);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
