export type MentionSearchResult = {
    id: string;
    username: string;
    name: string | null;
    image: string | null;
};

const MENTION_TRIGGER = /(^|\s)@([a-zA-Z0-9._-]*)$/;
const MENTION_EXTRACTOR = /(^|\s)@([a-zA-Z0-9._-]+)/g;

export function getActiveMentionQuery(text: string, cursor: number) {
    const beforeCursor = text.slice(0, cursor);
    const match = beforeCursor.match(MENTION_TRIGGER);
    if (!match) return null;

    const fullMatch = match[0];
    const query = match[2] ?? "";
    const start = beforeCursor.length - fullMatch.length + fullMatch.lastIndexOf("@");

    return {
        query,
        start,
        end: cursor,
    };
}

export function replaceMentionAtCursor(text: string, cursor: number, username: string) {
    const activeMention = getActiveMentionQuery(text, cursor);
    if (!activeMention) {
        return {
            nextValue: text,
            nextCursor: cursor,
        };
    }

    const replacement = `@${username} `;
    const nextValue = `${text.slice(0, activeMention.start)}${replacement}${text.slice(activeMention.end)}`;
    const nextCursor = activeMention.start + replacement.length;

    return {
        nextValue,
        nextCursor,
    };
}

export function extractMentionUsernames(...texts: Array<string | null | undefined>) {
    const usernames = new Set<string>();

    for (const text of texts) {
        if (!text) continue;
        let match: RegExpExecArray | null;
        while ((match = MENTION_EXTRACTOR.exec(text)) !== null) {
            const username = match[2]?.trim().toLowerCase();
            if (username) usernames.add(username);
        }
        MENTION_EXTRACTOR.lastIndex = 0;
    }

    return Array.from(usernames);
}
