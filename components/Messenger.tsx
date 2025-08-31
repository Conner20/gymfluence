'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

type LiteUser = {
    id: string;
    username: string | null;
    name: string | null;
    image?: string | null;
};

type ConversationRow = {
    id: string;
    updatedAt: string;
    other: LiteUser | null;
    lastMessage: { id: string; content: string; createdAt: string; isMine: boolean; imageUrls?: string[] } | null;
};

type ThreadMessage = {
    id: string;
    content: string;
    imageUrls?: string[];
    createdAt: string;
    isMine: boolean;
    readAt: string | null;
};

export default function Messenger() {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Left: conversations
    const [convos, setConvos] = useState<ConversationRow[]>([]);
    const [convosLoading, setConvosLoading] = useState(true);
    const [convosError, setConvosError] = useState<string | null>(null);

    // Right: active thread
    const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
    const [activeOther, setActiveOther] = useState<LiteUser | null>(null);
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [threadLoading, setThreadLoading] = useState(false);
    const [threadError, setThreadError] = useState<string | null>(null);

    // Compose
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // images
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // search
    const [search, setSearch] = useState('');
    const [searchFollowers, setSearchFollowers] = useState<LiteUser[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // guards
    const threadAbortRef = useRef<AbortController | null>(null);
    const threadReqIdRef = useRef(0);

    const otherKey = useMemo(() => activeOther?.username || activeOther?.id || null, [activeOther]);
    const lastTimestamp = useMemo(
        () => (messages.length ? messages[messages.length - 1].createdAt : null),
        [messages]
    );

    const formatTimestamp = useCallback((iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        const opts: Intl.DateTimeFormatOptions = sameDay
            ? { hour: 'numeric', minute: '2-digit' }
            : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
        return d.toLocaleString(undefined, opts);
    }, []);

    const filteredConvos = useMemo(() => {
        if (!search.trim()) return convos;
        const q = search.toLowerCase();
        return convos.filter((c) => {
            const name = (c.other?.username || c.other?.name || 'user').toLowerCase();
            const text = (c.lastMessage?.content || '').toLowerCase();
            const hasPhoto = (c.lastMessage?.imageUrls?.length ?? 0) > 0;
            return name.includes(q) || text.includes(q) || (hasPhoto && 'photo'.includes(q));
        });
    }, [convos, search]);

    // -------- helpers --------

    const normalizeConvos = (rows: ConversationRow[]) => {
        const map = new Map<string, ConversationRow>(); // key: other.id
        for (const c of rows) {
            const k = c.other?.id;
            if (!k) continue;
            const existing = map.get(k);
            if (!existing) {
                map.set(k, c);
            } else {
                const ta = new Date(existing.lastMessage?.createdAt || existing.updatedAt).getTime();
                const tb = new Date(c.lastMessage?.createdAt || c.updatedAt).getTime();
                if (tb > ta) map.set(k, c);
            }
        }
        const list = Array.from(map.values());
        list.sort((a, b) => {
            const ta = new Date(a.lastMessage?.createdAt || a.updatedAt).getTime();
            const tb = new Date(b.lastMessage?.createdAt || b.updatedAt).getTime();
            return tb - ta;
        });
        return list;
    };

    const fetchConversations = useCallback(async () => {
        try {
            setConvosError(null);
            const res = await fetch('/api/messages/conversations', { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const data: ConversationRow[] = await res.json();
            setConvos(normalizeConvos(data));
        } catch {
            setConvosError('Failed to load conversations.');
        } finally {
            setConvosLoading(false);
        }
    }, []);

    // followers search (server)
    useEffect(() => {
        const q = search.trim();
        if (q.length < 2) {
            setSearchFollowers([]);
            setSearchLoading(false);
            return;
        }
        let alive = true;
        setSearchLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
                if (!res.ok) throw new Error();
                const data: { followers: LiteUser[] } = await res.json();
                if (!alive) return;
                setSearchFollowers(data.followers);
            } catch {
                if (alive) setSearchFollowers([]);
            } finally {
                if (alive) setSearchLoading(false);
            }
        }, 250);
        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [search]);

    // preview URLs
    useEffect(() => {
        previews.forEach((u) => URL.revokeObjectURL(u));
        const next = files.map((f) => URL.createObjectURL(f));
        setPreviews(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files.length]);

    // Upload images using multipart/form-data (no Firebase)
    const uploadImages = async (filesToUpload: File[]) => {
        if (filesToUpload.length === 0) return [];
        const form = new FormData();
        filesToUpload.forEach((f) => form.append('images', f));
        const res = await fetch('/api/uploads/images', { method: 'POST', body: form });
        if (!res.ok) throw new Error('Upload failed');
        const data: { urls: string[] } = await res.json();
        return data.urls || [];
    };

    // load thread (with race guards)
    const loadThread = useCallback(
        async (primaryKey: string, fallbackUsername?: string) => {
            threadAbortRef.current?.abort();

            const reqId = ++threadReqIdRef.current;
            const abort = new AbortController();
            threadAbortRef.current = abort;

            const showSpinner = messages.length === 0;
            setThreadError(null);
            if (showSpinner) setThreadLoading(true);

            try {
                let res = await fetch(`/api/messages?to=${encodeURIComponent(primaryKey)}`, {
                    cache: 'no-store',
                    signal: abort.signal,
                });

                if (!res.ok && fallbackUsername) {
                    const viaId = convos.find((c) => c.other?.username === fallbackUsername)?.other?.id;
                    if (viaId) {
                        res = await fetch(`/api/messages?to=${encodeURIComponent(viaId)}`, {
                            cache: 'no-store',
                            signal: abort.signal,
                        });
                    }
                }

                if (!res.ok) throw new Error(await res.text());

                const data: {
                    conversationId: string;
                    other: LiteUser;
                    messages: ThreadMessage[];
                } = await res.json();

                if (reqId !== threadReqIdRef.current) return;

                setActiveConvoId(data.conversationId);
                setActiveOther(data.other);
                setMessages(data.messages);

                setConvos((prev) => {
                    const newest = data.messages.at(-1) || null;
                    const updated: ConversationRow = {
                        id: data.conversationId,
                        updatedAt: newest?.createdAt || new Date().toISOString(),
                        other: data.other,
                        lastMessage: newest
                            ? {
                                id: newest.id,
                                content: newest.content,
                                createdAt: newest.createdAt,
                                isMine: newest.isMine,
                                imageUrls: newest.imageUrls ?? [],
                            }
                            : null,
                    };
                    const byOther = new Map(prev.map((c) => [c.other?.id, c]));
                    byOther.set(data.other.id, updated);
                    return normalizeConvos(Array.from(byOther.values()));
                });
            } catch (err: any) {
                if (err?.name !== 'AbortError') setThreadError('Failed to load messages.');
            } finally {
                if (showSpinner) setThreadLoading(false);
                inputRef.current?.focus();
            }
        },
        [convos, messages.length]
    );

    // poll for new messages
    const pollThreadSince = useCallback(async () => {
        if (!otherKey) return;

        const reqId = threadReqIdRef.current;
        try {
            const url = lastTimestamp
                ? `/api/messages?to=${encodeURIComponent(otherKey)}&cursor=${encodeURIComponent(lastTimestamp)}`
                : `/api/messages?to=${encodeURIComponent(otherKey)}`;

            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return;

            const data: {
                conversationId: string;
                other: LiteUser;
                messages: ThreadMessage[];
            } = await res.json();

            if (reqId !== threadReqIdRef.current) return;
            if (data.other?.id !== activeOther?.id) return;

            if (data.messages?.length) {
                setMessages((prev) => {
                    const merged = [...prev];
                    for (const m of data.messages) {
                        if (!prev.some((p) => p.id === m.id)) merged.push(m);
                    }
                    return merged;
                });

                const newest = data.messages[data.messages.length - 1];
                setConvos((list) =>
                    normalizeConvos(
                        list.map((c) =>
                            c.id === data.conversationId
                                ? {
                                    ...c,
                                    lastMessage: {
                                        id: newest.id,
                                        content: newest.content,
                                        createdAt: newest.createdAt,
                                        isMine: newest.isMine,
                                        imageUrls: newest.imageUrls ?? [],
                                    },
                                    updatedAt: newest.createdAt,
                                }
                                : c
                        )
                    )
                );
            }
        } catch {
            /* ignore */
        }
    }, [otherKey, lastTimestamp, activeOther?.id]);

    // send message (text + images)
    const send = useCallback(async () => {
        if ((!draft.trim() && files.length === 0) || !activeOther) return;

        const text = draft.trim();
        const filesToSend = files.slice();
        setDraft('');
        setFiles([]);
        setPreviews([]);

        // Upload images first
        let uploaded: string[] = [];
        try {
            uploaded = await uploadImages(filesToSend);
        } catch {
            return;
        }

        // optimistic UI
        const tempId = `temp-${Date.now()}`;
        const nowIso = new Date().toISOString();
        const optimistic: ThreadMessage = {
            id: tempId,
            content: text,
            imageUrls: uploaded,
            createdAt: nowIso,
            isMine: true,
            readAt: null,
        };
        setMessages((m) => [...m, optimistic]);

        if (activeConvoId) {
            setConvos((list) =>
                normalizeConvos(
                    list.map((c) =>
                        c.id === activeConvoId
                            ? {
                                ...c,
                                lastMessage: {
                                    id: tempId,
                                    content: text,
                                    imageUrls: uploaded,
                                    createdAt: nowIso,
                                    isMine: true,
                                },
                                updatedAt: nowIso,
                            }
                            : c
                    )
                )
            );
        }

        try {
            const toField = activeOther.username || activeOther.id;
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: toField, content: text, imageUrls: uploaded }),
            });
            if (!res.ok) throw new Error();
            const data: { id: string; createdAt: string; conversationId: string } = await res.json();
            setActiveConvoId((prev) => prev ?? data.conversationId);
            setMessages((prev) =>
                prev.map((m) => (m.id === tempId ? { ...m, id: data.id, createdAt: data.createdAt } : m))
            );
            fetchConversations();
        } catch {
            // rollback optimistic
            setMessages((m) => m.filter((msg) => msg.id !== tempId));
        } finally {
            inputRef.current?.focus();
        }
    }, [draft, files, activeOther, activeConvoId, fetchConversations]);

    // -------- effects --------

    useEffect(() => {
        setConvosLoading(true);
        fetchConversations();
        const t = setInterval(fetchConversations, 5000);
        return () => clearInterval(t);
    }, [fetchConversations]);

    useEffect(() => {
        const toParam = searchParams.get('to');
        if (!toParam) return;

        if (activeOther && (activeOther.username === toParam || activeOther.id === toParam)) {
            return;
        }

        const guess = convos.find(
            (c) => c.other?.username === toParam || c.other?.id === toParam
        )?.other;
        if (guess) {
            setActiveOther(guess);
            setActiveConvoId(null);
        }

        loadThread(toParam, toParam);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        if (!otherKey) return;
        const t = setInterval(pollThreadSince, 2000);
        return () => clearInterval(t);
    }, [otherKey, pollThreadSince]);

    // -------- actions --------

    const onPick = (row: ConversationRow) => {
        if (!row.other) return;

        setActiveConvoId(row.id);
        setActiveOther(row.other);
        setThreadError(null);

        const pretty = row.other.username || row.other.id;
        router.replace(`${pathname}?to=${encodeURIComponent(pretty)}`);

        loadThread(row.other.id, row.other.username || undefined);
    };

    const startChatWithUser = (user: LiteUser) => {
        setActiveConvoId(null);
        setActiveOther(user);
        setThreadError(null);

        const pretty = user.username || user.id;
        router.replace(`${pathname}?to=${encodeURIComponent(pretty)}`);

        loadThread(user.id, user.username || undefined);
        setSearch('');
        setSearchFollowers([]);
    };

    // ---- attachments renderer (smaller images + no awkward gaps) ----
    const Attachments = ({ urls }: { urls: string[] }) => {
        if (!urls || urls.length === 0) return null;
        if (urls.length === 1) {
            const u = urls[0]!;
            return (
                <a href={u} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={u}
                        alt="attachment"
                        className="rounded-lg max-w-full h-auto max-h-56"  // was max-h-80 → smaller
                    />
                </a>
            );
        }
        const gridCols =
            urls.length === 2 ? 'grid-cols-2' : urls.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';
        return (
            <div className={clsx('grid gap-2', gridCols)}>
                {urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={url}
                            alt="attachment"
                            className="rounded-lg w-full h-auto max-h-32 object-cover"  // was max-h-40 → smaller
                        />
                    </a>
                ))}
            </div>
        );
    };

    // -------- render --------

    return (
        <div
            className="w-full max-w-6xl bg-white rounded-2xl shadow ring-1 ring-black/5 overflow-hidden flex"
            style={{ height: '85vh' }}  // fixed height so inner panes scroll, not the page
        >
            {/* Left column */}
            <aside className="border-r w-[320px] flex-shrink-0 flex flex-col h-full">
                <div className="px-4 py-3 font-semibold">Messages</div>

                <div className="px-3 pb-3">
                    <input
                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                        placeholder="Search followers or conversations…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Scrollable left pane */}
                <div className="flex-1 overflow-y-auto px-0">
                    {search.trim().length >= 2 && (
                        <div className="px-3 pb-2">
                            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                                Start a new chat {searchLoading ? '(searching…)' : ''}
                            </div>
                            {searchFollowers.length === 0 && !searchLoading ? (
                                <div className="text-xs text-gray-400 mb-2">No matching followed users.</div>
                            ) : (
                                <ul className="mb-2">
                                    {searchFollowers.map((u) => (
                                        <li
                                            key={u.id}
                                            className="px-3 py-2 rounded cursor-pointer hover:bg-gray-50 flex items-center gap-3"
                                            onClick={() => startChatWithUser(u)}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                                {(u.username || u.name || 'U').slice(0, 2)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium truncate">{u.username || u.name || 'User'}</div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="h-px bg-gray-100 my-2" />
                        </div>
                    )}

                    <div className="px-0">
                        <div className="px-4 pb-2 text-[11px] uppercase tracking-wide text-gray-400">
                            Conversations
                        </div>
                        {convosLoading ? (
                            <div className="px-4 py-2 text-sm text-gray-500">Loading…</div>
                        ) : convosError ? (
                            <div className="px-4 py-2 text-sm text-red-500">{convosError}</div>
                        ) : filteredConvos.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-gray-400">No conversations found.</div>
                        ) : (
                            <ul>
                                {filteredConvos.map((c) => {
                                    const other = c.other;
                                    if (!other) return null;
                                    const name = other.username || other.name || 'User';
                                    const hasPhoto = (c.lastMessage?.imageUrls?.length ?? 0) > 0;
                                    const previewText =
                                        c.lastMessage
                                            ? (c.lastMessage.content?.trim()
                                                ? c.lastMessage.content
                                                : hasPhoto
                                                    ? '📷 Photo'
                                                    : 'No messages yet')
                                            : 'No messages yet';
                                    const active = c.id === activeConvoId || other.id === activeOther?.id;
                                    return (
                                        <li
                                            key={other.id}
                                            className={clsx(
                                                'px-4 py-3 cursor-pointer hover:bg-gray-50 border-b',
                                                active && 'bg-gray-100'
                                            )}
                                            onClick={() => onPick(c)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                                    {(other.username || other.name || 'U').slice(0, 2)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium truncate">{name}</div>
                                                    <div className="text-xs text-gray-500 truncate">{previewText}</div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </aside>

            {/* Right column */}
            <section className="flex flex-col h-full flex-1 overflow-hidden">
                {/* Fixed header */}
                <div className="h-14 border-b flex items-center gap-3 px-4 flex-shrink-0">
                    {activeOther ? (
                        <>
                            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                {(activeOther.username || activeOther.name || 'U').slice(0, 2)}
                            </div>
                            <div className="font-medium">
                                {activeOther.username || activeOther.name || 'User'}
                            </div>
                        </>
                    ) : (
                        <div className="text-sm text-gray-500">Select a conversation</div>
                    )}
                </div>

                {/* Scrollable messages area */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {!activeOther ? (
                        <div className="text-center text-sm text-gray-400 mt-20">No conversation selected.</div>
                    ) : threadLoading && messages.length === 0 ? (
                        <div className="text-center text-sm text-gray-400 mt-20">Loading…</div>
                    ) : messages.length === 0 ? (
                        <div className="text-center text-sm text-gray-300 mt-20">No messages yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {messages.map((m) => {
                                const ts = formatTimestamp(m.createdAt);
                                const hasText = Boolean(m.content && m.content.trim().length);
                                const imgs = m.imageUrls ?? [];
                                return (
                                    <div
                                        key={m.id}
                                        className={clsx('w-full flex flex-col', m.isMine ? 'items-end' : 'items-start')}
                                    >
                                        <div
                                            className={clsx(
                                                'rounded-2xl px-3 py-2 text-sm break-words max-w-[70%] inline-block',
                                                m.isMine ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'
                                            )}
                                            title={new Date(m.createdAt).toLocaleString()}
                                        >
                                            {hasText && <span>{m.content}</span>}

                                            {imgs.length > 0 && (
                                                <div className={clsx(hasText && 'mt-2')}>
                                                    <Attachments urls={imgs} />
                                                </div>
                                            )}
                                        </div>
                                        <div
                                            className={clsx(
                                                'mt-1 text-[10px] leading-none text-gray-400',
                                                m.isMine ? 'text-right pr-1' : 'text-left pl-1'
                                            )}
                                        >
                                            {ts}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {activeOther && threadError && (
                        <div className="mt-3 text-center text-xs text-red-500">{threadError}</div>
                    )}
                </div>

                {/* Fixed composer */}
                <div className="h-16 border-t flex items-center gap-2 px-4 flex-shrink-0">
                    <input
                        key={otherKey || 'no-thread'}
                        ref={inputRef}
                        className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/40"
                        placeholder="Type a message..."
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        disabled={!activeOther || !session}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            const picked = Array.from(e.target.files || []);
                            const maxBytes = 8 * 1024 * 1024;
                            const valid = picked.filter((f) => f.type.startsWith('image/') && f.size <= maxBytes);
                            setFiles((prev) => [...prev, ...valid].slice(0, 10));
                            e.currentTarget.value = '';
                        }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!activeOther || !session}
                        className={clsx(
                            'px-3 py-2 rounded-full text-sm font-medium border',
                            !activeOther || !session ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'
                        )}
                        title="Attach images"
                    >
                        + Image
                    </button>
                    <button
                        onClick={send}
                        disabled={!activeOther || !session || (!draft.trim() && files.length === 0)}
                        className={clsx(
                            'px-4 py-2 rounded-full text-sm font-medium',
                            !activeOther || !session || (!draft.trim() && files.length === 0)
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-900 text-white hover:bg-black'
                        )}
                    >
                        Send
                    </button>
                </div>

                {/* Selected image previews (scroll with page? keep fixed height content below composer) */}
                {files.length > 0 && (
                    <div className="border-t px-4 py-3">
                        <div className="text-xs text-gray-500 mb-2">Attachments</div>
                        <div className="grid grid-cols-4 gap-2">
                            {previews.map((url, i) => (
                                <div key={i} className="relative group">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt="preview" className="h-24 w-full object-cover rounded-lg" />
                                    <button
                                        className="absolute -top-2 -right-2 bg-black/70 text-white text-[10px] rounded-full px-1.5 py-0.5 opacity-0 group-hover:opacity-100"
                                        onClick={() => {
                                            setFiles((prev) => prev.filter((_, idx) => idx !== i));
                                            setPreviews((prev) => prev.filter((_, idx) => idx !== i));
                                        }}
                                        title="Remove"
                                    >
                                        x
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
