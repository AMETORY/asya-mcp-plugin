// Kontrak RPC plugin ↔ TUI. Hanya metadata non-secret yang melintas:
// tidak ada token, tidak ada kode enrollasi di input maupun output.
import { Rpc } from "@opencode/plugin/rpc";

export type AsyaMetadata = {
  name: string;
  organizationId: string;
  enrolledAt: string;
  tokenPrefix: string;
};

const metadataProperties = {
  name: { type: "string" },
  organizationId: { type: "string" },
  enrolledAt: { type: "string" },
  tokenPrefix: { type: "string" },
} as const;

const metadataRequired = [
  "name",
  "organizationId",
  "enrolledAt",
  "tokenPrefix",
] as const;

const codeInput = {
  type: "object",
  properties: { code: { type: "string" } },
  required: ["code"],
  additionalProperties: false,
} as const;

const metadataOutput = {
  type: "object",
  properties: metadataProperties,
  required: [...metadataRequired],
} as const;

// Tanpa input bermakna: skema objek kosong (status dipanggil tanpa argumen).
const noInput = {
  type: "object",
  properties: {},
} as const;

const statusOutput = {
  type: "object",
  properties: { connected: { type: "boolean" }, ...metadataProperties },
  required: ["connected"],
} as const;

export const Asya = Rpc.define({
  id: "asya",
  methods: {
    connect: { input: codeInput, output: metadataOutput },
    rotate: { input: codeInput, output: metadataOutput },
    status: { input: noInput, output: statusOutput },
  },
  // `Rpc.define` mewajibkan field events pada tipe Definition; kosong = tanpa event.
  events: {},
});
