import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildEnrollUrl,
  enroll,
  extractEnrollCode,
  isValidEnrollCode,
} from "../src/enroll.ts";
import { resolveOptions } from "../src/options.ts";

const url = "https://example.supabase.co/functions/v1";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("URL enrollment", () => {
  it("default options menghasilkan satu segmen /functions/v1", () => {
    const options = resolveOptions({ url });
    expect(options.functionsPath).toBe("/asya-mcp");
    expect(options.mcpUrl).toBe(`${url}/asya-mcp/mcp`);
    expect(buildEnrollUrl(options)).toBe(`${url}/asya-mcp/enroll`);
  });

  it("menghormati override functionsPath", () => {
    expect(
      buildEnrollUrl({
        url: "https://example.supabase.co",
        functionsPath: "/functions/v1/asya-mcp",
      }),
    ).toBe("https://example.supabase.co/functions/v1/asya-mcp/enroll");
  });
});

describe("ekstraksi kode enroll", () => {
  it("menerima kode 8 karakter sebagai token berdiri sendiri", () => {
    expect(extractEnrollCode("ABCDEFG2")).toBe("ABCDEFG2");
    expect(extractEnrollCode("/asya-connect ABCDEFG2")).toBe("ABCDEFG2");
    expect(extractEnrollCode("  ABCDEFG2  ")).toBe("ABCDEFG2");
  });

  it("menolak kode yang cuma substring dari teks lain", () => {
    expect(extractEnrollCode("ABCDEFGHX")).toBeNull();
    expect(extractEnrollCode("abcABCDEFGH")).toBeNull();
    expect(extractEnrollCode("ABCDEFG2H dengan catatan")).toBeNull();
  });
});

describe("validasi kode enrollasi", () => {
  it("menerima kode 8 karakter [A-Z2-9] dan menolak yang lain", () => {
    expect(isValidEnrollCode("ABCDEFG2")).toBe(true);
    expect(isValidEnrollCode(" ABCDEFG2 ")).toBe(true);
    expect(isValidEnrollCode("abcdefg2")).toBe(false);
    expect(isValidEnrollCode("ABCDEFG1")).toBe(false); // digit 1 dilarang
    expect(isValidEnrollCode("ABCDEFG")).toBe(false);
    expect(isValidEnrollCode("")).toBe(false);
  });
});

describe("validasi kode enroll", () => {
  it("menolak kode 9 karakter sebelum fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      enroll("ABCDEFGHX", { url, functionsPath: "/asya-mcp" }),
    ).rejects.toThrow("Kode enrollasi tidak valid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mengirim POST ke URL hasil konstruksi", async () => {
    const token = "asya_mcp_ABCDEFGH1234";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token,
          name: "token uji",
          token_type: "mcp",
          feature_keys: [],
          expires_at: null,
          organization_id: "00000000-0000-0000-0000-000000000000",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await enroll("ABCDEFG2", { url, functionsPath: "/asya-mcp" });

    expect(fetchMock).toHaveBeenCalledWith(
      `${url}/asya-mcp/enroll`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "ABCDEFG2" }),
      }),
    );
    expect(result.token).toBe(token);
  });
});

describe("opsi plugin", () => {
  it("url kosong ditolak dengan pesan yang menyebut url", () => {
    expect(() => resolveOptions({})).toThrow(/url/);
  });
});
