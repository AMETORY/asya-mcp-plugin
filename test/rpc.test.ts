import { describe, expect, it } from "vitest";

import { Asya } from "../src/rpc.ts";

describe("kontrak RPC asya", () => {
  it("mendefinisikan connect, rotate, dan status", () => {
    expect(Object.keys(Asya.methods).sort()).toEqual([
      "connect",
      "rotate",
      "status",
    ]);
  });

  it("output connect/rotate tidak mengandung token maupun code", () => {
    for (const name of ["connect", "rotate"] as const) {
      const out = Asya.methods[name].output as {
        properties: Record<string, unknown>;
        required?: string[];
      };
      expect(Object.keys(out.properties).sort()).toEqual([
        "enrolledAt",
        "name",
        "organizationId",
        "organizationName",
        "tokenPrefix",
      ]);
      expect(out.required?.slice().sort()).toEqual([
        "enrolledAt",
        "name",
        "organizationId",
        "tokenPrefix",
      ]);
      expect(Object.keys(out.properties)).not.toContain("token");
      expect(Object.keys(out.properties)).not.toContain("code");
    }
  });

  it("input connect/rotate hanya menerima code", () => {
    for (const name of ["connect", "rotate"] as const) {
      const input = Asya.methods[name].input as {
        properties: Record<string, unknown>;
        required?: string[];
        additionalProperties?: boolean;
      };
      expect(Object.keys(input.properties)).toEqual(["code"]);
      expect(input.required).toEqual(["code"]);
      expect(input.additionalProperties).toBe(false);
    }
  });

  it("status mengembalikan connected wajib plus metadata opsional", () => {
    const out = Asya.methods.status.output as {
      properties: Record<string, unknown>;
      required?: string[];
    };
    expect(Object.keys(out.properties).sort()).toEqual([
      "connected",
      "enrolledAt",
      "name",
      "organizationId",
      "organizationName",
      "tokenPrefix",
    ]);
    expect(out.required).toEqual(["connected"]);
    expect(Object.keys(out.properties)).not.toContain("token");
    expect(Object.keys(out.properties)).not.toContain("code");
  });
});
