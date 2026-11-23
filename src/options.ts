// Resolusi opsi plugin. `url` adalah base Supabase functions yang sudah
// mengandung segmen /functions/v1; `functionsPath` hanya nama function.

export interface ResolvedOptions {
  url: string;
  functionsPath: string;
  serverName: string;
  mcpUrl: string;
}

export function resolveOptions(raw: unknown): ResolvedOptions {
  const pluginOptions = (raw ?? {}) as Record<string, unknown>;
  const url = typeof pluginOptions.url === "string" ? pluginOptions.url : "";
  if (!url) {
    throw new Error("Plugin asya-mcp butuh opsi `url` (URL Supabase functions).");
  }
  const functionsPath =
    typeof pluginOptions.functionsPath === "string"
      ? pluginOptions.functionsPath
      : "/asya-mcp";
  const serverName =
    typeof pluginOptions.serverName === "string"
      ? pluginOptions.serverName
      : "asya-core";
  const mcpUrl =
    typeof pluginOptions.mcpUrl === "string"
      ? pluginOptions.mcpUrl
      : `${url}${functionsPath}/mcp`;
  return { url, functionsPath, serverName, mcpUrl };
}
