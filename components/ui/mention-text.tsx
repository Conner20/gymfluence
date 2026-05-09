"use client";

import Link from "next/link";

const MENTION_REGEX = /(^|\s)(@[\w.-]+)/g;

export default function MentionText({
    text,
    className,
    mentionClassName,
}: {
    text: string;
    className?: string;
    mentionClassName?: string;
}) {
    const parts: Array<{ text: string; mention: boolean }> = [];
    let lastIndex = 0;

    for (const match of text.matchAll(MENTION_REGEX)) {
        const fullMatch = match[0];
        const leading = match[1] ?? "";
        const mention = match[2] ?? "";
        const start = match.index ?? 0;
        const mentionStart = start + leading.length;

        if (start > lastIndex) {
            parts.push({ text: text.slice(lastIndex, start), mention: false });
        }
        if (leading) {
            parts.push({ text: leading, mention: false });
        }
        parts.push({ text: mention, mention: true });
        lastIndex = mentionStart + mention.length;
    }

    if (lastIndex < text.length) {
        parts.push({ text: text.slice(lastIndex), mention: false });
    }

    return (
        <span className={className}>
            {parts.length === 0
                ? text
                : parts.map((part, index) =>
                      part.mention ? (
                        <Link
                            key={`${part.text}-${index}`}
                            href={`/u/${encodeURIComponent(part.text.slice(1))}`}
                            className={mentionClassName || "font-bold hover:underline"}
                            title={`View ${part.text}'s profile`}
                        >
                              {part.text}
                          </Link>
                      ) : (
                          <span key={`${part.text}-${index}`}>{part.text}</span>
                      ),
                  )}
        </span>
    );
}
