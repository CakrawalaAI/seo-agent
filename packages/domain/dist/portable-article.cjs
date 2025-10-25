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

// src/portable-article.ts
var portable_article_exports = {};
__export(portable_article_exports, {
  PortableArticleBlockSchema: () => PortableArticleBlockSchema,
  PortableArticleDocumentSchema: () => PortableArticleDocumentSchema
});
module.exports = __toCommonJS(portable_article_exports);
var import_zod = require("zod");
var PortableArticleBlockSchema = import_zod.z.discriminatedUnion("kind", [
  import_zod.z.object({
    kind: import_zod.z.literal("paragraph"),
    html: import_zod.z.string()
  }),
  import_zod.z.object({
    kind: import_zod.z.literal("quote"),
    html: import_zod.z.string(),
    citation: import_zod.z.string().optional()
  }),
  import_zod.z.object({
    kind: import_zod.z.literal("image"),
    src: import_zod.z.string(),
    alt: import_zod.z.string().optional(),
    caption: import_zod.z.string().optional()
  }),
  import_zod.z.object({
    kind: import_zod.z.literal("embed"),
    provider: import_zod.z.string(),
    url: import_zod.z.string().url(),
    html: import_zod.z.string().optional()
  })
]);
var PortableArticleDocumentSchema = import_zod.z.object({
  metadata: import_zod.z.object({
    title: import_zod.z.string(),
    description: import_zod.z.string().optional(),
    canonicalUrl: import_zod.z.string().url().optional(),
    tags: import_zod.z.array(import_zod.z.string()).optional(),
    locale: import_zod.z.string().min(2).optional()
  }),
  content: import_zod.z.array(PortableArticleBlockSchema)
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PortableArticleBlockSchema,
  PortableArticleDocumentSchema
});
