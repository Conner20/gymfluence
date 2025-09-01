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
    isGroup: boolean;
    groupName?: string | null;
    groupMembers?: LiteUser[];
    other: LiteUser | null;
    lastMessage: { id: string; content: string; createdAt: string; isMine: boolean; imageUrls?: string[] } | null;
    unreadCount?: number;
};

type ThreadMessage = {
    id: string;
    content: string;
    imageUrls?: string[];
    createdAt: string;
    isMine: boolean;
    readAt: string | null;
    sender?: LiteUser | null;
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
    const [activeOther, setActiveOther] = useState<LiteUser | null>(null); // DM
    const [activeGroupMembers, setActiveGroupMembers] = useState<LiteUser[] | null>(null); // Group
    const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
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

    // search (left)
    const [search, setSearch] = useState('');
    const [searchFollowers, setSearchFollowers] = useState<LiteUser[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // NEW GROUP
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [groupQuery, setGroupQuery] = useState('');
    const [groupResults, setGroupResults] = useState<LiteUser[]>([]);
    const [groupLoading, setGroupLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // MANAGE modal
    const [showManage, setShowManage] = useState(false);
    const [groupNameInput, setGroupNameInput] = useState('');

    // ADD PEOPLE (Manage)
    const [addQuery, setAddQuery] = useState('');
    const [addResults, setAddResults] = useState<LiteUser[]>([]);
    const [addLoading, setAddLoading] = useState(false);
    const [addSelectedIds, setAddSelectedIds] = useState<string[]>([]);

    // guards
    const threadAbortRef = useRef<AbortController | null>(null);
    const threadReqIdRef = useRef(0);

    const myUsername = (session?.user as any)?.username as string | undefined;

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

    const goToProfile = (u: LiteUser | undefined | null) => {
        if (!u) return;
        const slug = u.username || u.id;
        router.push(`/profile/${encodeURIComponent(slug)}`);
    };

    // ---------- system message helpers ----------
    const SYS_PREFIX = '[SYS] ';
    const isSystemMessage = (m: ThreadMessage) => {
        if ((m.imageUrls?.length ?? 0) > 0) return false;
        if (m.content?.startsWith(SYS_PREFIX)) return true;
        const t = m.content?.trim() || '';
        return (
            t.toLowerCase().endsWith(' left the conversation.') ||
            / removed .+ from the conversation\.$/i.test(t)
        );
    };
    const systemText = (m: ThreadMessage) =>
        m.content?.startsWith(SYS_PREFIX) ? m.content.slice(SYS_PREFIX.length) : m.content;

    // ---------------- helpers ----------------

    const normalizeConvos = (rows: ConversationRow[]) => {
        const byKey = new Map<string, ConversationRow>();
        const pickNewest = (a: ConversationRow, b: ConversationRow) => {
            const ta = new Date(a.lastMessage?.createdAt || a.updatedAt).getTime();
            const tb = new Date(b.lastMessage?.createdAt || b.updatedAt).getTime();
            return tb > ta ? b : a;
        };
        for (const c of rows) {
            const realGroup = c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
            if (realGroup) {
                const key = `grp:${c.id}`;
                byKey.set(key, byKey.get(key) ? pickNewest(byKey.get(key)!, c) : c);
                continue;
            }
            const dmOtherId = c.other?.id || c.groupMembers?.[0]?.id || c.id;
            const key = `dm:${dmOtherId}`;
            byKey.set(key, byKey.get(key) ? pickNewest(byKey.get(key)!, c) : c);
        }
        const list = Array.from(byKey.values());
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

    // followers search (left)
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

    // NEW GROUP search
    useEffect(() => {
        if (!showNewGroup) return;
        const q = groupQuery.trim();
        if (q.length < 2) {
            setGroupResults([]);
            setGroupLoading(false);
            return;
        }
        let alive = true;
        setGroupLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
                if (!res.ok) throw new Error();
                const data: { followers: LiteUser[] } = await res.json();
                if (!alive) return;
                setGroupResults(data.followers);
            } catch {
                if (alive) setGroupResults([]);
            } finally {
                if (alive) setGroupLoading(false);
            }
        }, 250);
        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [groupQuery, showNewGroup]);

    // Manage modal add-users search
    useEffect(() => {
        if (!showManage || !activeGroupMembers) return;
        const q = addQuery.trim();
        if (q.length < 2) {
            setAddResults([]);
            setAddLoading(false);
            return;
        }
        let alive = true;
        setAddLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
                if (!res.ok) throw new Error();
                const data: { followers: LiteUser[] } = await res.json();
                if (!alive) return;
                setAddResults(data.followers);
            } catch {
                if (alive) setAddResults([]);
            } finally {
                if (alive) setAddLoading(false);
            }
        }, 250);
        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [addQuery, showManage, activeGroupMembers]);

    // React to ?newGroup
    useEffect(() => {
        const wants = searchParams.get('newGroup') === '1';
        setShowNewGroup(wants);
        if (!wants) {
            setGroupQuery('');
            setGroupResults([]);
            setSelectedIds([]);
        }
    }, [searchParams]);

    // Create object URLs for previews
    useEffect(() => {
        previews.forEach((u) => URL.revokeObjectURL(u));
        const next = files.map((f) => URL.createObjectURL(f));
        setPreviews(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files.length]);

    const uploadImages = async (filesToUpload: File[]) => {
        if (filesToUpload.length === 0) return [];
        const form = new FormData();
        filesToUpload.forEach((f) => form.append('images', f));
        const res = await fetch('/api/uploads/images', { method: 'POST', body: form });
        if (!res.ok) throw new Error('Upload failed');
        const data: { urls: string[] } = await res.json();
        return data.urls || [];
    };

    // ---------- Thread loaders ----------
    const loadByConversationId = useCallback(
        async (cid: string) => {
            threadAbortRef.current?.abort();
            const reqId = ++threadReqIdRef.current;
            const abort = new AbortController();
            threadAbortRef.current = abort;

            const showSpinner = messages.length === 0;
            setThreadError(null);
            if (showSpinner) setThreadLoading(true);

            try {
                const res = await fetch(`/api/messages?conversationId=${encodeURIComponent(cid)}`, {
                    cache: 'no-store',
                    signal: abort.signal,
                });
                if (!res.ok) throw new Error(await res.text());

                const data: {
                    conversationId: string;
                    other?: LiteUser | null;
                    group?: { name: string | null; members: LiteUser[] };
                    messages: ThreadMessage[];
                } = await res.json();

                if (reqId !== threadReqIdRef.current) return;

                setActiveConvoId(data.conversationId);
                setActiveOther(data.other ?? null);
                setActiveGroupMembers(data.group?.members ?? null);
                setActiveGroupName(data.group?.name ?? null);
                setMessages(data.messages);

                setConvos((prev) =>
                    normalizeConvos(
                        prev.map((c) =>
                            c.id === data.conversationId ? { ...c, unreadCount: 0, groupName: data.group?.name ?? c.groupName } : c
                        )
                    )
                );
            } catch (err: any) {
                if (err?.name !== 'AbortError') setThreadError('Failed to load messages.');
            } finally {
                if (showSpinner) setThreadLoading(false);
                inputRef.current?.focus();
            }
        },
        [messages.length]
    );

    const loadByTo = useCallback(
        async (primaryKey: string) => {
            threadAbortRef.current?.abort();

            const reqId = ++threadReqIdRef.current;
            const abort = new AbortController();
            threadAbortRef.current = abort;

            const showSpinner = messages.length === 0;
            setThreadError(null);
            if (showSpinner) setThreadLoading(true);

            try {
                const res = await fetch(`/api/messages?to=${encodeURIComponent(primaryKey)}`, {
                    cache: 'no-store',
                    signal: abort.signal,
                });
                if (!res.ok) throw new Error(await res.text());

                const data: {
                    conversationId: string;
                    other: LiteUser;
                    messages: ThreadMessage[];
                } = await res.json();

                if (reqId !== threadReqIdRef.current) return;

                setActiveConvoId(data.conversationId);
                setActiveOther(data.other);
                setActiveGroupMembers(null);
                setActiveGroupName(null);
                setMessages(data.messages);

                setConvos((prev) => {
                    const newest = data.messages.at(-1) || null;
                    const updated: ConversationRow = {
                        id: data.conversationId,
                        updatedAt: newest?.createdAt || new Date().toISOString(),
                        isGroup: false,
                        other: data.other,
                        groupName: null,
                        groupMembers: undefined,
                        lastMessage: newest
                            ? { id: newest.id, content: newest.content, createdAt: newest.createdAt, isMine: newest.isMine, imageUrls: newest.imageUrls ?? [] }
                            : null,
                        unreadCount: 0,
                    };
                    const byKey = new Map(prev.map((c) => [c.isGroup ? `grp:${c.id}` : `dm:${c.other?.id ?? c.id}`, c]));
                    byKey.set(`dm:${data.other.id}`, updated);
                    return normalizeConvos(Array.from(byKey.values()));
                });
            } catch (err: any) {
                if (err?.name !== 'AbortError') setThreadError('Failed to load messages.');
            } finally {
                if (showSpinner) setThreadLoading(false);
                inputRef.current?.focus();
            }
        },
        [messages.length]
    );

    const pollThreadSince = useCallback(async () => {
        if (!activeConvoId) return;
        try {
            const url = lastTimestamp
                ? `/api/messages?conversationId=${encodeURIComponent(activeConvoId)}&cursor=${encodeURIComponent(lastTimestamp)}`
                : `/api/messages?conversationId=${encodeURIComponent(activeConvoId)}`;

            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return;

            const data: {
                conversationId: string;
                other?: LiteUser | null;
                group?: { name: string | null; members: LiteUser[] };
                messages: ThreadMessage[];
            } = await res.json();

            if (data.conversationId !== activeConvoId) return;

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
                                    unreadCount: 0,
                                    groupName: data.group?.name ?? c.groupName,
                                }
                                : c
                        )
                    )
                );
            }
        } catch {
            /* ignore */
        }
    }, [activeConvoId, lastTimestamp]);

    const send = useCallback(async () => {
        if ((!draft.trim() && files.length === 0) || (!activeConvoId && !activeOther)) return;

        const text = draft.trim();
        const filesToSend = files.slice();
        setDraft('');
        setFiles([]);
        setPreviews([]);

        let uploaded: string[] = [];
        try {
            uploaded = await uploadImages(filesToSend);
        } catch {
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const nowIso = new Date().toISOString();
        const optimistic: ThreadMessage = {
            id: tempId,
            content: text,
            imageUrls: uploaded,
            createdAt: nowIso,
            isMine: true,
            readAt: null,
            sender: { id: 'me', username: myUsername ?? 'you', name: 'You', image: null },
        };
        setMessages((m) => [...m, optimistic]);

        if (activeConvoId) {
            setConvos((list) =>
                normalizeConvos(
                    list.map((c) =>
                        c.id === activeConvoId
                            ? {
                                ...c,
                                lastMessage: { id: tempId, content: text, imageUrls: uploaded, createdAt: nowIso, isMine: true },
                                updatedAt: nowIso,
                            }
                            : c
                    )
                )
            );
        }

        try {
            const body = activeConvoId
                ? { conversationId: activeConvoId, content: text, imageUrls: uploaded }
                : { to: activeOther!.username || activeOther!.id, content: text, imageUrls: uploaded };

            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error();
            const data: { id: string; createdAt: string; conversationId: string } = await res.json();
            setActiveConvoId((prev) => prev ?? data.conversationId);
            setMessages((prev) =>
                prev.map((m) => (m.id === tempId ? { ...m, id: data.id, createdAt: data.createdAt } : m))
            );

            fetchConversations();
        } catch {
            setMessages((m) => m.filter((msg) => msg.id !== tempId));
        } finally {
            inputRef.current?.focus();
        }
    }, [draft, files, activeConvoId, activeOther, fetchConversations, myUsername]);

    // ---------------- effects ----------------

    useEffect(() => {
        setConvosLoading(true);
        fetchConversations();
        const t = setInterval(fetchConversations, 5000);
        return () => clearInterval(t);
    }, [fetchConversations]);

    // Deep-links
    useEffect(() => {
        const cid = searchParams.get('convoId');
        const to = searchParams.get('to');
        if (cid) {
            setActiveOther(null);
            setActiveGroupMembers(null);
            setActiveGroupName(null);
            setMessages([]);
            loadByConversationId(cid);
            return;
        }
        if (to) {
            const guess = convos.find((c) => !c.isGroup && (c.other?.username === to || c.other?.id === to))?.other;
            if (guess) {
                setActiveOther(guess);
                setActiveGroupMembers(null);
                setActiveGroupName(null);
                setMessages([]);
            }
            loadByTo(to);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        if (!activeConvoId) return;
        const t = setInterval(pollThreadSince, 2000);
        return () => clearInterval(t);
    }, [activeConvoId, pollThreadSince]);

    // ---------------- actions ----------------

    const onPick = (row: ConversationRow) => {
        setThreadError(null);
        setMessages([]);

        const realGroup = row.isGroup && ((row.groupMembers?.length ?? 0) >= 2);

        if (realGroup) {
            setActiveOther(null);
            setActiveGroupMembers(row.groupMembers ?? []);
            setActiveGroupName(row.groupName ?? null);
            setActiveConvoId(row.id);
            router.replace(`${pathname}?convoId=${encodeURIComponent(row.id)}`);
            loadByConversationId(row.id);
        } else if (row.other) {
            setActiveOther(row.other);
            setActiveGroupMembers(null);
            setActiveGroupName(null);
            setActiveConvoId(row.id);
            const pretty = row.other.username || row.other.id;
            router.replace(`${pathname}?to=${encodeURIComponent(pretty)}`);
            loadByTo(row.other.id);
        }
    };

    const startChatWithUser = (user: LiteUser) => {
        setThreadError(null);
        setMessages([]);
        setActiveConvoId(null);
        setActiveOther(user);
        setActiveGroupMembers(null);
        setActiveGroupName(null);
        const pretty = user.username || user.id;
        router.replace(`${pathname}?to=${encodeURIComponent(pretty)}`);
        loadByTo(user.id);
        setSearch('');
        setSearchFollowers([]);
    };

    const Attachments = ({ urls }: { urls: string[] }) => {
        if (!urls || urls.length === 0) return null;
        if (urls.length === 1) {
            const u = urls[0]!;
            return (
                <a href={u} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="attachment" className="rounded-lg max-w-full h-auto max-h-56" />
                </a>
            );
        }
        const gridCols = urls.length === 2 ? 'grid-cols-2' : urls.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';
        return (
            <div className={clsx('grid gap-2', gridCols)}>
                {urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="attachment" className="rounded-lg w-full h-auto max-h-32 object-cover" />
                    </a>
                ))}
            </div>
        );
    };

    const normalized = normalizeConvos(convos);

    return (
        <div className="w-full max-w-6xl bg-white rounded-2xl shadow ring-1 ring-black/5 overflow-hidden flex" style={{ height: '85vh' }}>
            {/* Left column */}
            <aside className="border-r w-[340px] flex-shrink-0 flex flex-col h-full">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="font-semibold">Messages</div>
                    <button
                        onClick={() => {
                            setShowNewGroup(true);
                            router.replace(`${pathname}?newGroup=1`);
                        }}
                        className="text-xs px-2 py-1 rounded bg-gray-900 text-white hover:bg-black"
                    >
                        New Group
                    </button>
                </div>

                <div className="px-3 pb-3">
                    <input
                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                        placeholder="Search followers or conversations…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {search && (
                    <div className="px-3 pb-2">
                        <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Start chat</div>
                        <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                            {searchLoading ? (
                                <div className="p-2 text-sm text-gray-500">Searching…</div>
                            ) : searchFollowers.length === 0 ? (
                                <div className="p-2 text-sm text-gray-400">No matches</div>
                            ) : (
                                searchFollowers.map((u) => (
                                    <div
                                        key={u.id}
                                        className="p-2 text-sm hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                                        onClick={() => startChatWithUser(u)}
                                    >
                                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] uppercase">
                                            {(u.username || u.name || 'U').slice(0, 2)}
                                        </div>
                                        <div className="truncate">{u.username || u.name || 'User'}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-0">
                    <div className="px-0">
                        <div className="px-4 pb-2 text-[11px] uppercase tracking-wide text-gray-400">Conversations</div>
                        {convosLoading ? (
                            <div className="px-4 py-2 text-sm text-gray-500">Loading…</div>
                        ) : convosError ? (
                            <div className="px-4 py-2 text-sm text-red-500">{convosError}</div>
                        ) : normalized.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-gray-400">No conversations found.</div>
                        ) : (
                            <ul>
                                {normalized.map((c) => {
                                    const realGroup = c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
                                    const active = c.id === activeConvoId || (!realGroup && c.other?.id === activeOther?.id);
                                    const title = realGroup ? (c.groupName || 'Group') : (c.other?.username || c.other?.name || 'User');
                                    const hasPhoto = (c.lastMessage?.imageUrls?.length ?? 0) > 0;
                                    const previewText = c.lastMessage
                                        ? (c.lastMessage.content?.trim() ? c.lastMessage.content : hasPhoto ? '📷 Photo' : 'No messages yet')
                                        : 'No messages yet';

                                    return (
                                        <li
                                            key={realGroup ? `grp:${c.id}` : `dm:${c.other?.id}`}
                                            className={clsx('px-4 py-3 cursor-pointer hover:bg-gray-50 border-b', active && 'bg-gray-100')}
                                            onClick={() => onPick(c)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                                    {realGroup ? 'G' : (c.other?.username || c.other?.name || 'U').slice(0, 2)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium truncate">
                                                        {realGroup ? (
                                                            title
                                                        ) : (
                                                            <button
                                                                className="hover:underline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    goToProfile(c.other);
                                                                }}
                                                                title={title}
                                                            >
                                                                {title}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate">{previewText}</div>
                                                </div>
                                                {(c.unreadCount ?? 0) > 0 && !active && (
                                                    <span
                                                        className="inline-block w-2 h-2 rounded-full bg-green-500 ml-2 flex-shrink-0"
                                                        title={`${c.unreadCount} unread`}
                                                        aria-label={`${c.unreadCount} unread`}
                                                    />
                                                )}
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
                {/* Header */}
                <div className="h-14 border-b flex items-center gap-3 px-4 flex-shrink-0">
                    {activeConvoId ? (
                        <>
                            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                {activeGroupMembers ? 'G' : (activeOther?.username || activeOther?.name || 'U').slice(0, 2)}
                            </div>
                            <div className="font-medium truncate flex-1">
                                {activeGroupMembers ? (
                                    activeGroupName ? (
                                        <span className="truncate">{activeGroupName}</span>
                                    ) : (
                                        <span className="truncate">
                                            {activeGroupMembers
                                                .filter((u) => !myUsername || u.username !== myUsername)
                                                .map((u, idx) => (
                                                    <button
                                                        key={u.id}
                                                        className="hover:underline mr-1"
                                                        onClick={() => goToProfile(u)}
                                                        title={u.username || u.name || 'User'}
                                                    >
                                                        {(u.username || u.name || 'User') + (idx < activeGroupMembers.length - 1 ? ',' : '')}
                                                    </button>
                                                ))}
                                        </span>
                                    )
                                ) : (
                                    <button className="hover:underline" onClick={() => goToProfile(activeOther!)}>
                                        {activeOther?.username || activeOther?.name || 'User'}
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    setGroupNameInput(activeGroupName ?? '');
                                    setAddQuery('');
                                    setAddResults([]);
                                    setAddSelectedIds([]);
                                    setShowManage(true);
                                }}
                                className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                                title="Manage conversation"
                            >
                                Manage
                            </button>
                        </>
                    ) : (
                        <div className="text-sm text-gray-500">Select a conversation</div>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {!activeConvoId ? (
                        <div className="text-center text-sm text-gray-400 mt-20">No conversation selected.</div>
                    ) : threadLoading && messages.length === 0 ? (
                        <div className="text-center text-sm text-gray-400 mt-20">Loading…</div>
                    ) : messages.length === 0 ? (
                        <div className="text-center text-sm text-gray-300 mt-20">No messages yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {messages.map((m) => {
                                if (isSystemMessage(m)) {
                                    return (
                                        <div key={m.id} className="w-full flex">
                                            <div className="mx-auto text-[12px] text-gray-500 italic">{systemText(m)}</div>
                                        </div>
                                    );
                                }
                                const ts = formatTimestamp(m.createdAt);
                                const hasText = Boolean(m.content && m.content.trim().length);
                                const imgs = m.imageUrls ?? [];
                                const sender = m.sender;
                                const senderLabel = sender?.username || sender?.name || (m.isMine ? 'You' : 'User');

                                return (
                                    <div key={m.id} className={clsx('w-full flex flex-col', m.isMine ? 'items-end' : 'items-start')}>
                                        {activeGroupMembers && !m.isMine && (
                                            <button
                                                className="text-[11px] mb-0.5 text-left pl-1 text-gray-600 hover:underline"
                                                onClick={() => goToProfile(sender || null)}
                                                title={senderLabel}
                                            >
                                                {senderLabel}
                                            </button>
                                        )}
                                        <div
                                            className={clsx(
                                                'rounded-2xl px-3 py-2 text-sm break-words max-w-[70%] inline-block',
                                                m.isMine ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'
                                            )}
                                            title={new Date(m.createdAt).toLocaleString()}
                                        >
                                            {hasText && <span>{m.content}</span>}
                                            {imgs.length > 0 && <div className={clsx(hasText && 'mt-2')}><Attachments urls={imgs} /></div>}
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
                    {activeConvoId && threadError && (
                        <div className="mt-3 text-center text-xs text-red-500">{threadError}</div>
                    )}
                </div>

                {/* Composer */}
                <div className="h-16 border-t flex items-center gap-2 px-4 flex-shrink-0">
                    <input
                        key={activeConvoId || activeOther?.id || 'no-thread'}
                        ref={inputRef}
                        className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/40"
                        placeholder="Type a message..."
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        disabled={!(activeConvoId || activeOther) || !session}
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
                        disabled={!(activeConvoId || activeOther) || !session}
                        className={clsx(
                            'px-3 py-2 rounded-full text-sm font-medium border',
                            !(activeConvoId || activeOther) || !session
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-white hover:bg-gray-50'
                        )}
                        title="Attach images"
                    >
                        + Image
                    </button>
                    <button
                        onClick={send}
                        disabled={!(activeConvoId || activeOther) || !session || (!draft.trim() && files.length === 0)}
                        className={clsx(
                            'px-4 py-2 rounded-full text-sm font-medium',
                            !(activeConvoId || activeOther) || !session || (!draft.trim() && files.length === 0)
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-900 text-white hover:bg-black'
                        )}
                    >
                        Send
                    </button>
                </div>

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
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* NEW GROUP MODAL */}
            {showNewGroup && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                    <div className="bg-white w-[520px] max-w-[92vw] rounded-xl shadow-lg p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold">Create Group</h3>
                            <button className="text-sm px-2 py-1 rounded hover:bg-gray-100" onClick={() => router.replace(pathname)}>
                                Close
                            </button>
                        </div>

                        <p className="text-sm text-gray-500 mb-2">
                            Select at least <strong>two</strong> people to start a group.
                        </p>

                        <input
                            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                            placeholder="Search your followers…"
                            value={groupQuery}
                            onChange={(e) => setGroupQuery(e.target.value)}
                        />

                        <div className="mt-3 max-h-52 overflow-y-auto border rounded-md divide-y">
                            {groupLoading ? (
                                <div className="p-3 text-sm text-gray-500">Searching…</div>
                            ) : groupResults.length === 0 ? (
                                <div className="p-3 text-sm text-gray-400">No people found.</div>
                            ) : (
                                groupResults.map((u) => {
                                    const checked = selectedIds.includes(u.id);
                                    return (
                                        <label key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4"
                                                checked={checked}
                                                onChange={(e) => {
                                                    setSelectedIds((prev) =>
                                                        e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                                                    );
                                                }}
                                            />
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                                {(u.username || u.name || 'U').slice(0, 2)}
                                            </div>
                                            <div className="truncate">{u.username || u.name || 'User'}</div>
                                        </label>
                                    );
                                })
                            )}
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="text-xs text-gray-500">Selected: {selectedIds.length}</div>
                            <button
                                className={clsx(
                                    "px-3 py-2 rounded-md text-sm font-medium",
                                    selectedIds.length < 2 ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gray-900 text-white hover:bg-black"
                                )}
                                disabled={selectedIds.length < 2}
                                onClick={async () => {
                                    try {
                                        const res = await fetch("/api/conversations", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ userIds: selectedIds }),
                                        });
                                        if (!res.ok) {
                                            const data = await res.json().catch(() => ({}));
                                            alert(data?.message || "Failed to create group.");
                                            return;
                                        }
                                        const data: { conversationId: string } = await res.json();

                                        router.replace(`${pathname}?convoId=${encodeURIComponent(data.conversationId)}`);
                                        setShowNewGroup(false);
                                        setGroupQuery('');
                                        setGroupResults([]);
                                        setSelectedIds([]);
                                        await fetchConversations();
                                        await loadByConversationId(data.conversationId);
                                    } catch {
                                        alert("Failed to create group.");
                                    }
                                }}
                            >
                                Create Group
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MANAGE CONVERSATION MODAL */}
            {showManage && activeConvoId && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                    <div className="bg-white w-[600px] max-w-[92vw] rounded-xl shadow-lg p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold">Conversation settings</h3>
                            <button
                                className="text-sm px-2 py-1 rounded hover:bg-gray-100"
                                onClick={() => {
                                    setShowManage(false);
                                    setAddQuery('');
                                    setAddResults([]);
                                    setAddSelectedIds([]);
                                }}
                            >
                                Close
                            </button>
                        </div>

                        {activeGroupMembers ? (
                            <>
                                {/* Group name */}
                                <div className="mb-5">
                                    <div className="text-sm font-medium mb-1">Group name</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                                            placeholder="Add a name (optional)"
                                            value={groupNameInput}
                                            onChange={(e) => setGroupNameInput(e.target.value)}
                                        />
                                        <button
                                            className={clsx(
                                                "px-3 py-2 rounded-md text-sm font-medium",
                                                groupNameInput === (activeGroupName ?? '') ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gray-900 text-white hover:bg-black"
                                            )}
                                            disabled={groupNameInput === (activeGroupName ?? '')}
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(`/api/conversations/${encodeURIComponent(activeConvoId)}`, {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ name: groupNameInput }),
                                                    });
                                                    if (!res.ok) {
                                                        const data = await res.json().catch(() => ({}));
                                                        alert(data?.message || "Failed to rename group.");
                                                        return;
                                                    }
                                                    const data: { conversationId: string; name: string | null } = await res.json();
                                                    setActiveGroupName(data.name ?? null);
                                                    setGroupNameInput(data.name ?? '');
                                                    // reflect on left list
                                                    setConvos((prev) =>
                                                        prev.map((c) => (c.id === data.conversationId ? { ...c, groupName: data.name } : c))
                                                    );
                                                } catch {
                                                    alert("Failed to rename group.");
                                                }
                                            }}
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>

                                {/* Add people */}
                                <div className="mb-5">
                                    <div className="text-sm font-medium mb-1">Add people</div>
                                    <input
                                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                                        placeholder="Search your followers…"
                                        value={addQuery}
                                        onChange={(e) => setAddQuery(e.target.value)}
                                    />
                                    <div className="mt-2 max-h-48 overflow-y-auto border rounded-md divide-y">
                                        {addLoading ? (
                                            <div className="p-3 text-sm text-gray-500">Searching…</div>
                                        ) : addResults.length === 0 ? (
                                            <div className="p-3 text-sm text-gray-400">No people found.</div>
                                        ) : (
                                            addResults.map((u) => {
                                                const alreadyIn = activeGroupMembers.some((m) => m.id === u.id);
                                                const checked = addSelectedIds.includes(u.id);
                                                const disabled = alreadyIn;
                                                return (
                                                    <label
                                                        key={u.id}
                                                        className={clsx(
                                                            "flex items-center gap-3 px-3 py-2 text-sm cursor-pointer",
                                                            disabled ? "opacity-50" : "hover:bg-gray-50"
                                                        )}
                                                        title={alreadyIn ? "Already in this conversation" : ""}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4"
                                                            checked={checked}
                                                            disabled={disabled}
                                                            onChange={(e) => {
                                                                setAddSelectedIds((prev) =>
                                                                    e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                                                                );
                                                            }}
                                                        />
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                                            {(u.username || u.name || 'U').slice(0, 2)}
                                                        </div>
                                                        <div className="truncate">{u.username || u.name || 'User'}</div>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="mt-3 flex items-center justify-end">
                                        <button
                                            className={clsx(
                                                "px-3 py-2 rounded-md text-sm font-medium",
                                                addSelectedIds.length < 1 ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gray-900 text-white hover:bg-black"
                                            )}
                                            disabled={addSelectedIds.length < 1}
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(`/api/conversations/${encodeURIComponent(activeConvoId)}/participants`, {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ userIds: addSelectedIds }),
                                                    });
                                                    if (!res.ok) {
                                                        const data = await res.json().catch(() => ({}));
                                                        alert(data?.message || "Failed to add users.");
                                                        return;
                                                    }
                                                    const data = await res.json();
                                                    setActiveGroupMembers(data.participants);
                                                    setAddQuery('');
                                                    setAddResults([]);
                                                    setAddSelectedIds([]);
                                                    await fetchConversations();
                                                    await loadByConversationId(activeConvoId);
                                                } catch {
                                                    alert("Failed to add users.");
                                                }
                                            }}
                                        >
                                            Add to Group
                                        </button>
                                    </div>
                                </div>

                                {/* Members list */}
                                <div className="text-sm text-gray-500 mb-2">Members</div>
                                <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
                                    {activeGroupMembers.map((u) => (
                                        <div key={u.id} className="flex items-center gap-3 px-3 py-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                                {(u.username || u.name || 'U').slice(0, 2)}
                                            </div>
                                            <button
                                                className="text-sm hover:underline text-left truncate"
                                                title={u.username || u.name || 'User'}
                                                onClick={() => goToProfile(u)}
                                            >
                                                {u.username || u.name || 'User'}
                                            </button>
                                            <div className="flex-1" />
                                            {u.username !== myUsername && (
                                                <button
                                                    className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                                                    onClick={async () => {
                                                        try {
                                                            const res = await fetch(`/api/conversations/${encodeURIComponent(activeConvoId)}/participants`, {
                                                                method: "DELETE",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({ userId: u.id }),
                                                            });
                                                            if (!res.ok) throw new Error(await res.text());
                                                            const data = await res.json();

                                                            if (data.deleted) {
                                                                setShowManage(false);
                                                                setActiveConvoId(null);
                                                                setActiveGroupMembers(null);
                                                                setActiveGroupName(null);
                                                                setActiveOther(null);
                                                                setMessages([]);
                                                                router.replace(pathname);
                                                            } else {
                                                                setActiveGroupMembers(data.participants);
                                                                await fetchConversations();
                                                                await loadByConversationId(activeConvoId);
                                                            }
                                                        } catch {
                                                            alert("Failed to remove user.");
                                                        }
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 flex items-center justify-between">
                                    <div />
                                    <button
                                        className="px-3 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                                        onClick={async () => {
                                            try {
                                                const res = await fetch(`/api/conversations/${encodeURIComponent(activeConvoId)}`, {
                                                    method: "DELETE",
                                                });
                                                if (!res.ok) throw new Error(await res.text());
                                                setShowManage(false);
                                                setActiveConvoId(null);
                                                setActiveGroupMembers(null);
                                                setActiveGroupName(null);
                                                setActiveOther(null);
                                                setMessages([]);
                                                router.replace(pathname);
                                                await fetchConversations();
                                            } catch {
                                                alert("Failed to leave conversation.");
                                            }
                                        }}
                                    >
                                        Leave Conversation
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-sm text-gray-500 mb-4">
                                    This is a direct message. You can delete the conversation.
                                </div>
                                <div className="flex items-center justify-end">
                                    <button
                                        className="px-3 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                                        onClick={async () => {
                                            try {
                                                const res = await fetch(`/api/conversations/${encodeURIComponent(activeConvoId)}`, {
                                                    method: "DELETE",
                                                });
                                                if (!res.ok) throw new Error(await res.text());
                                                setShowManage(false);
                                                setActiveConvoId(null);
                                                setActiveOther(null);
                                                setMessages([]);
                                                router.replace(pathname);
                                                await fetchConversations();
                                            } catch {
                                                alert("Failed to delete conversation.");
                                            }
                                        }}
                                    >
                                        Delete Conversation
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}