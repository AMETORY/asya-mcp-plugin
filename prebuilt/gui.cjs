"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/gui.ts
var gui_exports = {};
__export(gui_exports, {
  default: () => gui_default
});
module.exports = __toCommonJS(gui_exports);
var import_gui = require("@opencode/plugin/gui");

// src/enroll.ts
var CODE_PATTERN = /^[A-Z2-9]{8}$/;
function isValidEnrollCode(code) {
  return CODE_PATTERN.test(code.trim());
}

// src/errorMessage.ts
function formatErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}

// src/rpc.ts
var import_rpc = require("@opencode/plugin/rpc");
var metadataProperties = {
  name: { type: "string" },
  organizationId: { type: "string" },
  organizationName: { type: "string" },
  enrolledAt: { type: "string" },
  tokenPrefix: { type: "string" }
};
var metadataRequired = [
  "name",
  "organizationId",
  "enrolledAt",
  "tokenPrefix"
];
var codeInput = {
  type: "object",
  properties: { code: { type: "string" } },
  required: ["code"],
  additionalProperties: false
};
var metadataOutput = {
  type: "object",
  properties: metadataProperties,
  required: [...metadataRequired]
};
var noInput = {
  type: "object",
  properties: {}
};
var statusOutput = {
  type: "object",
  properties: { connected: { type: "boolean" }, ...metadataProperties },
  required: ["connected"]
};
var Asya = import_rpc.Rpc.define({
  id: "asya",
  methods: {
    connect: { input: codeInput, output: metadataOutput },
    rotate: { input: codeInput, output: metadataOutput },
    status: { input: noInput, output: statusOutput }
  },
  // `Rpc.define` mewajibkan field events pada tipe Definition; kosong = tanpa event.
  events: {}
});

// src/gui.ts
var gui_default = import_gui.Plugin.define({
  setup(ctx) {
    const tampilkanError = (error) => {
      ctx.toast.show({
        title: "asya-core",
        description: formatErrorMessage(error),
        variant: "error"
      });
    };
    const mintaKode = async () => {
      const code = await ctx.dialogs.prompt({
        title: "Kode enrollasi asya-core",
        description: "8 karakter [A-Z2-9], sekali pakai.",
        secret: true
      });
      if (!code) return null;
      if (!isValidEnrollCode(code)) {
        ctx.toast.show({
          title: "asya-core",
          description: "Kode harus 8 karakter [A-Z2-9].",
          variant: "error"
        });
        return null;
      }
      return code.trim();
    };
    ctx.add(import_gui.Command, {
      id: "asya.connect",
      title: "Hubungkan asya-core",
      slash: { name: "asya-connect" },
      run: async () => {
        const code = await mintaKode();
        if (!code) return;
        try {
          const rpc = ctx.client.rpc(Asya);
          const result = await rpc.connect({ code });
          ctx.toast.show({
            title: "asya-core",
            description: `Terhubung: ${result.name ?? "-"} (organisasi ${result.organizationName ?? result.organizationId ?? "-"}).`,
            variant: "success"
          });
        } catch (error) {
          tampilkanError(error);
        }
      }
    });
    ctx.add(import_gui.Command, {
      id: "asya.rotate",
      title: "Rotasi token asya-core",
      slash: { name: "asya-rotate-token" },
      run: async () => {
        const code = await mintaKode();
        if (!code) return;
        try {
          const rpc = ctx.client.rpc(Asya);
          const result = await rpc.rotate({ code });
          ctx.toast.show({
            title: "asya-core",
            description: `Token dirotasi: ${result.name ?? "-"} (organisasi ${result.organizationName ?? result.organizationId ?? "-"}).`,
            variant: "success"
          });
        } catch (error) {
          tampilkanError(error);
        }
      }
    });
    ctx.add(import_gui.Command, {
      id: "asya.status",
      title: "Status asya-core",
      slash: { name: "asya-status" },
      run: async () => {
        try {
          const rpc = ctx.client.rpc(Asya);
          const result = await rpc.status({});
          if (!result.connected) {
            ctx.toast.show({
              title: "asya-core",
              description: "asya-core belum terenroll.",
              variant: "default"
            });
            return;
          }
          ctx.toast.show({
            title: "asya-core",
            description: `Terhubung: ${result.name ?? "-"} (organisasi ${result.organizationName ?? result.organizationId ?? "-"}).`,
            variant: "success"
          });
        } catch (error) {
          tampilkanError(error);
        }
      }
    });
  }
});
