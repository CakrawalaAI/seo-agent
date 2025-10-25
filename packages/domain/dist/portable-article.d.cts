import { z } from 'zod';

declare const PortableArticleBlockSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"paragraph">;
    html: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "paragraph";
    html: string;
}, {
    kind: "paragraph";
    html: string;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"quote">;
    html: z.ZodString;
    citation: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "quote";
    html: string;
    citation?: string | undefined;
}, {
    kind: "quote";
    html: string;
    citation?: string | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"image">;
    src: z.ZodString;
    alt: z.ZodOptional<z.ZodString>;
    caption: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "image";
    src: string;
    alt?: string | undefined;
    caption?: string | undefined;
}, {
    kind: "image";
    src: string;
    alt?: string | undefined;
    caption?: string | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"embed">;
    provider: z.ZodString;
    url: z.ZodString;
    html: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "embed";
    provider: string;
    url: string;
    html?: string | undefined;
}, {
    kind: "embed";
    provider: string;
    url: string;
    html?: string | undefined;
}>]>;
type PortableArticleBlock = z.infer<typeof PortableArticleBlockSchema>;
declare const PortableArticleDocumentSchema: z.ZodObject<{
    metadata: z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        canonicalUrl: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        locale: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description?: string | undefined;
        canonicalUrl?: string | undefined;
        tags?: string[] | undefined;
        locale?: string | undefined;
    }, {
        title: string;
        description?: string | undefined;
        canonicalUrl?: string | undefined;
        tags?: string[] | undefined;
        locale?: string | undefined;
    }>;
    content: z.ZodArray<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"paragraph">;
        html: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "paragraph";
        html: string;
    }, {
        kind: "paragraph";
        html: string;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"quote">;
        html: z.ZodString;
        citation: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "quote";
        html: string;
        citation?: string | undefined;
    }, {
        kind: "quote";
        html: string;
        citation?: string | undefined;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"image">;
        src: z.ZodString;
        alt: z.ZodOptional<z.ZodString>;
        caption: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "image";
        src: string;
        alt?: string | undefined;
        caption?: string | undefined;
    }, {
        kind: "image";
        src: string;
        alt?: string | undefined;
        caption?: string | undefined;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"embed">;
        provider: z.ZodString;
        url: z.ZodString;
        html: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "embed";
        provider: string;
        url: string;
        html?: string | undefined;
    }, {
        kind: "embed";
        provider: string;
        url: string;
        html?: string | undefined;
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    metadata: {
        title: string;
        description?: string | undefined;
        canonicalUrl?: string | undefined;
        tags?: string[] | undefined;
        locale?: string | undefined;
    };
    content: ({
        kind: "paragraph";
        html: string;
    } | {
        kind: "quote";
        html: string;
        citation?: string | undefined;
    } | {
        kind: "image";
        src: string;
        alt?: string | undefined;
        caption?: string | undefined;
    } | {
        kind: "embed";
        provider: string;
        url: string;
        html?: string | undefined;
    })[];
}, {
    metadata: {
        title: string;
        description?: string | undefined;
        canonicalUrl?: string | undefined;
        tags?: string[] | undefined;
        locale?: string | undefined;
    };
    content: ({
        kind: "paragraph";
        html: string;
    } | {
        kind: "quote";
        html: string;
        citation?: string | undefined;
    } | {
        kind: "image";
        src: string;
        alt?: string | undefined;
        caption?: string | undefined;
    } | {
        kind: "embed";
        provider: string;
        url: string;
        html?: string | undefined;
    })[];
}>;
type PortableArticleDocument = z.infer<typeof PortableArticleDocumentSchema>;

export { type PortableArticleBlock, PortableArticleBlockSchema, type PortableArticleDocument, PortableArticleDocumentSchema };
