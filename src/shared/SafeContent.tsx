import React from "react";
import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import type { ContentPartApi } from "@/orval/search2o.schemas";

const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true,
    typographer: true,
});

type SafeContentProps = {
    part: ContentPartApi;
};

export const SafeContent: React.FC<SafeContentProps> = ({ part }) => {
    const { contentType } = part;

    if (contentType === "image") {
        if (part.text && part.mimeType) {
            return (
                <div className="mt-2">
                    <img
                        src={`data:${part.mimeType};base64,${part.text}`}
                        alt="Image output"
                        className="max-h-[320px] max-w-full rounded-md border object-contain"
                    />
                </div>
            );
        }
        return null;
    }

    if (contentType === "text") return <MarkdownText text={part.text} />;
    return <SanitizedHtml html={part.text} />;
};

export const MarkdownText: React.FC<{ text: string }> = ({ text }) => (
    <SanitizedHtml html={md.render(text)} />
);

const SanitizedHtml: React.FC<{ html: string }> = ({ html }) => (
    <div
        className="safe-prose prose prose-sm max-w-none break-words"
        dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }),
        }}
    />
);
