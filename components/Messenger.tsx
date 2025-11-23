'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Trash2, Camera } from 'lucide-react';

// --- SharedPostModal (auto-resizes to the real post height) ---
function SharedPostModal({
    postId,
    onClose,
}: {
    postId: string;
    onClose: () => void;
}) {
    const frameRef = React.useRef<HTMLIFrameElement>(null);

    React.useEffect(() => {
        function onMessage(e: MessageEvent) {
            if (!e.data || e.data.type !== 'post-embed-size') return;
            if (e.origin !== window.location.origin) return;
            const el = frameRef.current;
            if (!el) return;
            const maxH = Math.max(320, Math.min(e.data.height, window.innerHeight - 120));
            el.style.height = `${maxH}px`;
        }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-[min(96vw,1100px)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-2 border-b">
                    <div className="font-medium">Post</div>
                    <div className="flex items-center gap-4 text-sm">
                        <a
                            href={`/post/${encodeURIComponent(postId)}`}
                            className="text-gray-600 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Open in new tab
                        </a>
                        <button className="text-gray-600 hover:text-black" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>

                {/* Iframe auto-resizes via postMessage from /post/[id] */}
                <iframe
                    ref={frameRef}
                    src={`/post/${encodeURIComponent(postId)}`}
                    className="w-full block rounded-b-xl"
                    style={{
                        height:
                            typeof window !== 'undefined' ? Math.min(700, window.innerHeight - 120) : 700,
                    }}
                />
            </div>
        </div>
    );
}

type LiteUser = {
    id: string;
    username: string | null;
    name: string | null;
    image?: string | null;
};

const displayName = (u?: LiteUser | null, fallback = 'User') =>
    (u?.name && u.name.trim()) ||
    (u?.username && u.username.trim()) ||
    fallback;

type SharedPost = {
    id: string;
    title: string;
    imageUrl?: string | null;
    author: LiteUser;
};

type ConversationRow = {
    id: string;
    updatedAt: string;
    isGroup: boolean;
    groupName?: string | null;
    groupMembers?: LiteUser[];
    other: LiteUser | null;
    lastMessage: {
        id: string;
        content: string;
        createdAt: string;
        isMine: boolean;
        imageUrls?: string[];
    } | null;
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
    sharedUser?: LiteUser | null;
    sharedPost?: SharedPost | null;
};

type ShareDraft =
    | { type: 'profile'; url: string; label?: string; userId?: string }
    | { type: 'post'; post: SharedPost };

// --- Avatar helper (uses user.image if present, otherwise initials) ---
function Avatar({
    user,
    size = 32,
    fallbackChar = 'U',
}: {
    user?: LiteUser | null;
    size?: number;
    fallbackChar?: string;
}) {
    const label = displayName(user, fallbackChar || 'U');
    const initials = label.slice(0, 2).toUpperCase();
    const dim = `${size}px`;

    if (user?.image) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={user.image}
                alt={label}
                className="rounded-full object-cover"
                style={{ width: dim, height: dim }}
            />
        );
    }

    return (
        <div
            className="rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase"
            style={{ width: dim, height: dim }}
        >
            {initials}
        </div>
    );
}

export default function Messenger() {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname() ?? '/messages';
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

    // share composer (only from share buttons)
    const [shareDraft, setShareDraft] = useState<ShareDraft | null>(null);

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
    const [selectedUsers, setSelectedUsers] = useState<LiteUser[]>([]);

    // MANAGE modal
    const [showManage, setShowManage] = useState(false);
    const [groupNameInput, setGroupNameInput] = useState('');

    // ADD PEOPLE (Manage)
    const [addQuery, setAddQuery] = useState('');
    const [addResults, setAddResults] = useState<LiteUser[]>([]);
    const [addLoading, setAddLoading] = useState(false);
    const [addSelectedIds, setAddSelectedIds] = useState<string[]>([]);

    // Shared post modal
    const [openPostId, setOpenPostId] = useState<string | null>(null);

    // Mobile view state
    const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

    // guards
    const threadAbortRef = useRef<AbortController | null>(null);
    const threadReqIdRef = useRef(0);

    const myUsername = (session?.user as any)?.username as string | undefined;
    const myId = (session?.user as any)?.id as string | undefined;

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
        router.push(`/u/${encodeURIComponent(slug)}`);
    };

    // ---------- URL helpers ----------
    const linkify = (text: string) => {
        const parts = text.split(/(https?:\/\/[^\s]+|\/u\/[^\s]+)/g);
        return parts.map((p, i) => {
            if (/^(https?:\/\/[^\s]+|\/u\/[^\s]+)$/.test(p)) {
                return (
                    <a key={i} href={p} className="underline break-all" target="_blank" rel="noreferrer">
                        {p}
                    </a>
                );
            }
            return <span key={i}>{p}</span>;
        });
    };

    // ---------- system message helpers ----------
    // prefix changed from "[SYS] " to "* "
    const SYS_PREFIX = '* ';
    const isSystemMessage = (m: ThreadMessage) => {
        if ((m.imageUrls?.length ?? 0) > 0) return false;
        if (m.content?.startsWith(SYS_PREFIX)) return true;
        const t = m.content?.trim() || '';
        return (
            t.toLowerCase().endsWith(' left the conversation.') ||
            / removed .+ from the conversation\.$/i.test(t) ||
            / renamed the group from /.test(t) ||
            / named the group /.test(t) ||
            / removed the group name /.test(t)
        );
    };
    const systemText = (m: ThreadMessage) =>
        m.content?.startsWith(SYS_PREFIX) ? m.content.slice(SYS_PREFIX.length) : m.content;

    // ---------------- helpers ----------------

    const groupTitleFromMembers = (members?: LiteUser[], meId?: string) => {
        if (!members || members.length === 0) return 'Group';
        const others = meId ? members.filter((m) => m.id !== meId) : members;
        const base = others.length > 0 ? others : members;
        const label = base.map((u) => displayName(u)).join(', ');
        return label || 'Group';
    };

    // Collapse accidental duplicates; only show real groups (>= 2 other members)
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
            // DM: key by other user id to avoid duplicates
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
        const qLower = q.toLowerCase();
        let alive = true;
        setSearchLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`, {
                    cache: 'no-store',
                });
                if (!res.ok) throw new Error();
                const data: { followers: LiteUser[] } = await res.json();
                if (!alive) return;
                setSearchFollowers(
                    data.followers.filter((u) =>
                        ((u.name || u.username || '') as string).toLowerCase().includes(qLower)
                    )
                );
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
        const qLower = q.toLowerCase();
        let alive = true;
        setGroupLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`, {
                    cache: 'no-store',
                });
                if (!res.ok) throw new Error();
                const data: { followers: LiteUser[] } = await res.json();
                if (!alive) return;
                setGroupResults(
                    data.followers.filter((u) =>
                        ((u.name || u.username || '') as string).toLowerCase().includes(qLower)
                    )
                );
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
        const qLower = q.toLowerCase();
        let alive = true;
        setAddLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`, {
                    cache: 'no-store',
                });
                if (!res.ok) throw new Error();
                const data: { followers: LiteUser[] } = await res.json();
                if (!alive) return;
                setAddResults(
                    data.followers.filter((u) =>
                        ((u.name || u.username || '') as string).toLowerCase().includes(qLower)
                    )
                );
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

    // Parse share params (only from share buttons)
    useEffect(() => {
        if (!searchParams) return;
        const shareType = searchParams.get('shareType');
        const shareId = searchParams.get('shareId'); // for posts (post id)
        const shareUrl = searchParams.get('shareUrl'); // for profile (full url)
        const shareLabel = searchParams.get('shareLabel') || undefined; // for profile (display label)
        const shareUserId = searchParams.get('shareUserId') || undefined; // optional: profile's user id (for nicer card)

        if (shareType === 'profile' && shareUrl) {
            setShareDraft({ type: 'profile', url: shareUrl, label: shareLabel, userId: shareUserId });
        } else if (shareType === 'post' && shareId) {
            (async () => {
                try {
                    const res = await fetch(
                        `/api/share/preview?type=post&id=${encodeURIComponent(shareId)}`,
                        { cache: 'no-store' }
                    );
                    if (!res.ok) return;
                    const data = await res.json();
                    if (data?.post) {
                        setShareDraft({ type: 'post', post: data.post as SharedPost });
                    }
                } catch {
                    /* ignore */
                }
            })();
        }
    }, [searchParams]);

    // Create object URLs for previews
    useEffect(() => {
        return () => {
            previews.forEach((u) => URL.revokeObjectURL(u));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                setMobileView('thread');

                setConvos((prev) =>
                    normalizeConvos(
                        prev.map((c) =>
                            c.id === data.conversationId
                                ? { ...c, unreadCount: 0, groupName: data.group?.name ?? c.groupName }
                                : c
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
                setMobileView('thread');

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
                            ? {
                                id: newest.id,
                                content: newest.content,
                                createdAt: newest.createdAt,
                                isMine: newest.isMine,
                                imageUrls: newest.imageUrls ?? [],
                            }
                            : null,
                        unreadCount: 0,
                    };
                    const byKey = new Map(
                        prev.map((c) => [c.isGroup ? `grp:${c.id}` : `dm:${c.other?.id ?? c.id}`, c])
                    );
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
                ? `/api/messages?conversationId=${encodeURIComponent(
                    activeConvoId
                )}&cursor=${encodeURIComponent(lastTimestamp)}`
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

    const send = useCallback(
        async () => {
            const hasText = !!draft.trim();
            const hasFiles = files.length > 0;
            const hasShare = !!shareDraft;
            if (!hasText && !hasFiles && !hasShare) return;
            if (!activeConvoId && !activeOther) return;

            // For profile share: if no text provided, send the URL as content
            const profileUrl = shareDraft?.type === 'profile' ? shareDraft.url : '';
            const text = draft.trim() || profileUrl;

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
                sharedUser:
                    shareDraft?.type === 'profile' && shareDraft.userId
                        ? {
                            id: shareDraft.userId,
                            username: shareDraft.label ?? null,
                            name: shareDraft.label ?? null,
                        }
                        : null,
                sharedPost: shareDraft?.type === 'post' ? shareDraft.post : null,
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
                const body: any = activeConvoId
                    ? { conversationId: activeConvoId, content: text, imageUrls: uploaded }
                    : { to: activeOther!.username || activeOther!.id, content: text, imageUrls: uploaded };

                // Share payloads: profile -> map to "user" if userId present; post -> "post"
                if (shareDraft?.type === 'profile' && shareDraft.userId) {
                    body.share = { type: 'user', id: shareDraft.userId };
                } else if (shareDraft?.type === 'post') {
                    body.share = { type: 'post', id: shareDraft.post.id };
                }

                const res = await fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) throw new Error();
                const data: { id: string; createdAt: string; conversationId: string } = await res.json();
                setActiveConvoId((prev) => prev ?? data.conversationId);
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === tempId ? { ...m, id: data.id, createdAt: data.createdAt } : m
                    )
                );

                setShareDraft(null);
                // remove share params from URL
                const sp = new URLSearchParams(searchParams?.toString());
                sp.delete('shareType');
                sp.delete('shareId');
                sp.delete('shareUrl');
                sp.delete('shareLabel');
                sp.delete('shareUserId');
                router.replace(`${pathname}${sp.toString() ? `?${sp}` : ''}`);

                fetchConversations();
            } catch {
                setMessages((m) => m.filter((msg) => msg.id !== tempId));
            } finally {
                inputRef.current?.focus();
            }
        },
        [
            draft,
            files,
            activeConvoId,
            activeOther,
            fetchConversations,
            myUsername,
            shareDraft,
            router,
            pathname,
            searchParams,
        ]
    );

    // ---------------- effects ----------------

    useEffect(() => {
        setConvosLoading(true);
        fetchConversations();
        const t = setInterval(fetchConversations, 5000);
        return () => clearInterval(t);
    }, [fetchConversations]);

    // Deep-links
    useEffect(() => {
        if (!searchParams) return;
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
            const guess = convos.find(
                (c) => !c.isGroup && (c.other?.username === to || c.other?.id === to)
            )?.other;
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

    useEffect(() => {
        if (!activeConvoId) {
            setMobileView('list');
        }
    }, [activeConvoId]);

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
            setMobileView('thread');
        } else if (row.other) {
            setActiveOther(row.other);
            setActiveGroupMembers(null);
            setActiveGroupName(null);
            setActiveConvoId(row.id);
            const pretty = row.other.username || row.other.id;
            router.replace(`${pathname}?to=${encodeURIComponent(pretty)}`);
            loadByTo(row.other.id);
            setMobileView('thread');
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
        setMobileView('thread');
    };

    // NEW: delete conversation handler
    const handleDeleteConversation = async (conversationId: string) => {
        const ok = window.confirm(
            'Are you sure you want to delete this conversation? This will remove all messages for you.'
        );
        if (!ok) return;

        try {
            const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete conversation');

            setConvos((prev) => prev.filter((c) => c.id !== conversationId));

            if (activeConvoId === conversationId) {
                setActiveConvoId(null);
                setActiveOther(null);
                setActiveGroupMembers(null);
                setActiveGroupName(null);
                setMessages([]);
                router.replace(pathname);
            }
        } catch (e) {
            alert((e as Error).message || 'Failed to delete conversation.');
        }
    };

    // ---------- small components ----------
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
                            className="rounded-lg w-full h-auto max-h-32 object-cover"
                        />
                    </a>
                ))}
            </div>
        );
    };

    const ShareCard = ({ m }: { m: ThreadMessage }) => {
        const containerClasses =
            'block rounded-lg p-3 bg-white/80 hover:bg-white/90 backdrop-blur-sm text-black border border-black/20 no-underline';

        // PROFILE SHARE
        if (m.sharedUser || (m.content && /(https?:\/\/[^\s]+|\/u\/[^\s]+)/.test(m.content))) {
            const u = m.sharedUser;

            // Infer slug from URL if needed
            let linkFromContent =
                (m.content && /(https?:\/\/[^\s]+|\/u\/[^\s]+)/.exec(m.content)?.[0]) || '';
            let inferredSlug: string | undefined = u?.username || u?.name || u?.id || undefined;
            if (!inferredSlug && linkFromContent) {
                try {
                    const url = linkFromContent.startsWith('http')
                        ? new URL(linkFromContent)
                        : new URL(linkFromContent, window.location.origin);
                    const parts = url.pathname.split('/').filter(Boolean);
                    if (parts[0] === 'u' && parts[1]) inferredSlug = decodeURIComponent(parts[1]);
                } catch {
                    /* ignore */
                }
            }

            const display = displayName(u, inferredSlug || 'Profile');
            const href =
                linkFromContent || (inferredSlug ? `/u/${encodeURIComponent(inferredSlug)}` : '#');

            return (
                <a
                    href={href}
                    className={containerClasses}
                    onClick={(e) => e.stopPropagation()}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noreferrer' : undefined}
                >
                    <div className="flex items-center gap-3">
                        <Avatar user={u ?? null} size={40} fallbackChar="P" />
                        <div className="min-w-0">
                            <div className="text-sm font-medium truncate text-black">{display}</div>
                            <div className="text-xs truncate text-black">Open profile</div>
                        </div>
                    </div>
                </a>
            );
        }

        // POST SHARE — now same size as profile card (40×40 thumb, same paddings/typography)
        if (m.sharedPost) {
            const p = m.sharedPost;
            const author = p.author?.name || p.author?.username || 'Author';

            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpenPostId(p.id);
                    }}
                    className={`${containerClasses} w-full text-left`}
                    title="Open post"
                >
                    <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={p.imageUrl}
                                alt=""
                                className="w-10 h-10 object-cover rounded-md border-2 border-black flex-shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-md bg-white border-2 border-black flex items-center justify-center text-xs">
                                P
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="text-sm font-medium truncate text-black">{p.title}</div>
                            <div className="text-xs truncate text-black">by {author}</div>
                        </div>
                    </div>
                </button>
            );
        }

        return null;
    };

    const normalized = normalizeConvos(convos);

    return (
        <>
            <div
                className="w-full lg:max-w-6xl bg-white lg:rounded-2xl lg:shadow lg:ring-1 lg:ring-black/5 overflow-hidden flex flex-col lg:flex-row lg:min-h-[83vh]"
            >
                {/* Left column */}
                <aside
                    className={clsx(
                        'border-b lg:border-b-0 lg:border-r w-full lg:w-[340px] flex-shrink-0 flex flex-col h-full',
                        mobileView === 'thread' ? 'hidden lg:flex' : 'flex'
                    )}
                >
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
                            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                                Start chat
                            </div>
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
                                            <Avatar user={u} size={24} />
                                            <div className="truncate">{displayName(u)}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto px-0">
                        <div className="px-0">
                            <div className="px-4 pb-2 text-[11px] uppercase tracking-wide text-gray-400">
                                Conversations
                            </div>
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
                                        const active =
                                            c.id === activeConvoId ||
                                            (!realGroup && c.other?.id === activeOther?.id);
                                        const title = realGroup
                                            ? (c.groupName && c.groupName.trim()) ||
                                            groupTitleFromMembers(c.groupMembers, myId)
                                            : displayName(c.other);
                                        const hasPhoto = (c.lastMessage?.imageUrls?.length ?? 0) > 0;
                                        const previewText = c.lastMessage
                                            ? c.lastMessage.content?.trim()
                                                ? c.lastMessage.content
                                                : hasPhoto
                                                    ? '📷 Photo'
                                                    : 'No messages yet'
                                            : 'No messages yet';

                                        return (
                                            <li
                                                key={realGroup ? `grp:${c.id}` : `dm:${c.other?.id}`}
                                                className={clsx(
                                                    'px-4 py-3 cursor-pointer hover:bg-gray-50 border-b',
                                                    active && 'bg-gray-100'
                                                )}
                                                onClick={() => onPick(c)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {realGroup ? (
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                                            G
                                                        </div>
                                                    ) : (
                                                        <Avatar user={c.other} size={32} />
                                                    )}
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
                                                        <div className="text-xs text-gray-500 truncate">
                                                            {previewText}
                                                        </div>
                                                    </div>
                                                    {(c.unreadCount ?? 0) > 0 && !active && (
                                                        <span
                                                            className="inline-block w-2 h-2 rounded-full bg-green-500 ml-2 flex-shrink-0"
                                                            title={`${c.unreadCount} unread`}
                                                            aria-label={`${c.unreadCount} unread`}
                                                        />
                                                    )}
                                                    {/* Trash icon to delete conversation */}
                                                    <button
                                                        className="ml-2 text-gray-400 hover:text-red-500 flex-shrink-0"
                                                        title="Delete conversation"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteConversation(c.id);
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
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
                <section
                    className={clsx(
                        'flex flex-col h-full flex-1 overflow-hidden w-full',
                        mobileView === 'thread' ? 'flex' : 'hidden',
                        'lg:flex'
                    )}
                >
                    {/* Header */}
                    <div className="h-14 border-b flex items-center gap-3 px-4 flex-shrink-0">
                        <button
                            type="button"
                            className={clsx(
                                'lg:hidden text-sm text-gray-600 mr-2',
                                mobileView === 'thread' ? 'block' : 'hidden'
                            )}
                            onClick={() => setMobileView('list')}
                        >
                            ← Back
                        </button>
                        {activeConvoId ? (
                            <>
                                {activeGroupMembers ? (
                                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                        G
                                    </div>
                                ) : (
                                    <Avatar user={activeOther} size={36} />
                                )}
                                <div className="font-medium truncate flex-1">
                                    {activeGroupMembers ? (
                                        activeGroupName ? (
                                            <span className="truncate">{activeGroupName}</span>
                                        ) : (
                                            <span className="truncate">
                                                {activeGroupMembers
                                                    .filter((u) => !myId || u.id !== myId)
                                                    .map((u, idx, arr) => {
                                                        const label = displayName(u);
                                                        return (
                                                            <button
                                                                key={u.id}
                                                                className="hover:underline mr-1"
                                                                onClick={() => goToProfile(u)}
                                                                title={label}
                                                            >
                                                                {label}
                                                                {idx < arr.length - 1 ? ',' : ''}
                                                            </button>
                                                        );
                                                    })}
                                            </span>
                                        )
                                    ) : (
                                        <button
                                            className="hover:underline"
                                            onClick={() => goToProfile(activeOther!)}
                                        >
                                            {displayName(activeOther)}
                                        </button>
                                    )}
                                </div>

                                {activeGroupMembers && (
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
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-gray-500">Select a conversation</div>
                        )}
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        {!activeConvoId ? (
                            <div className="text-center text-sm text-gray-400 mt-20">
                                No conversation selected.
                            </div>
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
                                                <div className="mx-auto text-[12px] text-gray-500 italic">
                                                    {systemText(m)}
                                                </div>
                                            </div>
                                        );
                                    }
                                    const ts = formatTimestamp(m.createdAt);
                                    const hasText = Boolean(m.content && m.content.trim().length);
                                    const imgs = m.imageUrls ?? [];
                                    const sender = m.sender;
                                    const senderLabel = displayName(sender, m.isMine ? 'You' : 'User');
                                    const hasShare =
                                        !!m.sharedUser ||
                                        !!m.sharedPost ||
                                        (m.content && /^https?:\/\//.test(m.content));

                                    return (
                                        <div
                                            key={m.id}
                                            className={clsx(
                                                'w-full flex flex-col',
                                                m.isMine ? 'items-end' : 'items-start'
                                            )}
                                        >
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
                                                    m.isMine
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-100 text-gray-800'
                                                )}
                                                title={new Date(m.createdAt).toLocaleString()}
                                            >
                                                {hasText && <span>{linkify(m.content)}</span>}

                                                {imgs.length > 0 && (
                                                    <div className={clsx((hasText || hasShare) && 'mt-2')}>
                                                        <Attachments urls={imgs} />
                                                    </div>
                                                )}

                                                {hasShare && (
                                                    <div className={clsx((hasText || imgs.length > 0) && 'mt-2')}>
                                                        <ShareCard m={m} />
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
                        {activeConvoId && threadError && (
                            <div className="mt-3 text-center text-xs text-red-500">
                                {threadError}
                            </div>
                        )}
                    </div>

                    {/* Composer */}
                    <div className="border-t flex flex-col gap-2 px-4 py-3 flex-shrink-0">
                        {/* Share draft preview bar */}
                        {shareDraft && (
                            <div className="border rounded-lg p-2 flex items-center gap-3">
                                {shareDraft.type === 'profile' ? (
                                    <>
                                        <Avatar
                                            user={
                                                shareDraft.userId
                                                    ? {
                                                        id: shareDraft.userId,
                                                        username: shareDraft.label ?? null,
                                                        name: shareDraft.label ?? null,
                                                    }
                                                    : null
                                            }
                                            size={32}
                                            fallbackChar="P"
                                        />
                                        <div className="text-sm min-w-0">
                                            <div className="truncate">
                                                Sharing profile:{' '}
                                                <span className="font-medium">
                                                    {shareDraft.label || 'Profile'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">
                                                {shareDraft.url}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {shareDraft.post.imageUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={shareDraft.post.imageUrl}
                                                alt=""
                                                className="w-10 h-10 object-cover rounded-md"
                                            />
                                        )}
                                        <div className="text-sm min-w-0">
                                            <div className="truncate">
                                                Sharing post:{' '}
                                                <span className="font-medium">
                                                    {shareDraft.post.title}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">
                                                by{' '}
                                                {shareDraft.post.author.name ||
                                                    shareDraft.post.author.username ||
                                                    'Author'}
                                            </div>
                                        </div>
                                        <div className="flex-1" />
                                        <button
                                            type="button"
                                            className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                                            onClick={() => setOpenPostId(shareDraft.post.id)}
                                        >
                                            Preview
                                        </button>
                                    </>
                                )}
                                <div className="flex-1" />
                                <button
                                    className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                                    onClick={() => {
                                        setShareDraft(null);
                                        const sp = new URLSearchParams(searchParams?.toString());
                                        sp.delete('shareType');
                                        sp.delete('shareId');
                                        sp.delete('shareUrl');
                                        sp.delete('shareLabel');
                                        sp.delete('shareUserId');
                                        router.replace(
                                            `${pathname}${sp.toString() ? `?${sp}` : ''}`
                                        );
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        )}

                        <div className="h-10 flex items-center gap-2">
                            <input
                                key={activeConvoId || activeOther?.id || 'no-thread'}
                                ref={inputRef}
                                className="flex-1 h-full border rounded-full px-4 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-600/40"
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
                                    const valid = picked.filter(
                                        (f) => f.type.startsWith('image/') && f.size <= maxBytes
                                    );
                                    setFiles((prev) => [...prev, ...valid].slice(0, 10));
                                    e.currentTarget.value = '';
                                }}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!(activeConvoId || activeOther) || !session}
                                className={clsx(
                                    'px-3 py-2 rounded-full text-sm font-medium border flex items-center justify-center',
                                    !(activeConvoId || activeOther) || !session
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-white hover:bg-gray-50'
                                )}
                                title="Attach images"
                            >
                                <span className="sr-only">Add image</span>
                                <Camera size={18} />
                            </button>
                            <button
                                onClick={send}
                                disabled={
                                    !(activeConvoId || activeOther) ||
                                    !session ||
                                    (!draft.trim() && files.length === 0 && !shareDraft)
                                }
                                className={clsx(
                                    'px-4 py-2 rounded-full text-sm font-medium',
                                    !(activeConvoId || activeOther) ||
                                        !session ||
                                        (!draft.trim() && files.length === 0 && !shareDraft)
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-gray-900 text-white hover:bg-black'
                                )}
                            >
                                Send
                            </button>
                        </div>

                        {files.length > 0 && (
                            <div className="border rounded-lg p-2">
                                <div className="text-xs text-gray-500 mb-2">Attachments</div>
                                <div className="grid grid-cols-4 gap-2">
                                    {previews.map((url, i) => (
                                        <div key={i} className="relative group">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={url}
                                                alt="preview"
                                                className="h-24 w-full object-cover rounded-lg"
                                            />
                                            <button
                                                className="absolute -top-2 -right-2 bg-black/70 text-white text-[10px] rounded-full px-1.5 py-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                                                onClick={() => {
                                                    setFiles((prev) => prev.filter((_, idx) => idx !== i));
                                                    setPreviews((prev) =>
                                                        prev.filter((_, idx) => idx !== i)
                                                    );
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
                    </div>
                </section>

                {/* ----------- NEW GROUP MODAL ----------- */}
                {showNewGroup && (
                    <div
                        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
                        onClick={() => {
                            setShowNewGroup(false);
                            setSelectedIds([]);
                            setSelectedUsers([]);
                            router.replace(pathname);
                        }}
                    >
                        <div
                            className="bg-white p-5 rounded-xl shadow-lg w-[520px] max-w-[92vw]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-lg font-semibold">New Group</div>
                                <button
                                    className="text-sm text-gray-500 hover:text-black"
                                    onClick={() => {
                                        setShowNewGroup(false);
                                        setSelectedIds([]);
                                        setSelectedUsers([]);
                                        router.replace(pathname);
                                    }}
                                >
                                    Close
                                </button>
                            </div>

                            <div className="mb-2 text-xs text-gray-500">Add at least 2 people</div>
                            <input
                                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                                placeholder="Search your followers…"
                                value={groupQuery}
                                onChange={(e) => setGroupQuery(e.target.value)}
                            />

                            <div className="mt-3 border rounded-md max-h-56 overflow-y-auto divide-y">
                                {groupLoading ? (
                                    <div className="p-3 text-sm text-gray-500">Searching…</div>
                                ) : groupResults.length === 0 ? (
                                    <div className="p-3 text-sm text-gray-400">No matches</div>
                                ) : (
                                    groupResults.map((u) => {
                                        const chosen = selectedIds.includes(u.id);
                                        return (
                                            <label
                                                key={u.id}
                                                className="p-2 text-sm flex items-center gap-2 cursor-pointer hover:bg-gray-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={chosen}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setSelectedIds((prev) =>
                                                            checked
                                                                ? [...prev, u.id]
                                                                : prev.filter((id) => id !== u.id)
                                                        );
                                                        setSelectedUsers((prev) => {
                                                            if (checked) {
                                                                if (prev.some((p) => p.id === u.id)) return prev;
                                                                return [...prev, u];
                                                            }
                                                            return prev.filter((p) => p.id !== u.id);
                                                        });
                                                    }}
                                                />
                                                <Avatar user={u} size={24} />
                                                <div className="truncate">
                                                    {displayName(u)}
                                                </div>
                                            </label>
                                        );
                                    })
                                )}
                            </div>

                            {selectedUsers.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedUsers.map((u) => (
                                        <span
                                            key={u.id}
                                            className="px-2 py-1 text-xs bg-gray-100 rounded-full"
                                        >
                                            {displayName(u)}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    className="text-sm px-3 py-2 rounded border hover:bg-gray-50"
                                    onClick={() => {
                                        setShowNewGroup(false);
                                        setSelectedIds([]);
                                        setSelectedUsers([]);
                                        router.replace(pathname);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={clsx(
                                        'text-sm px-3 py-2 rounded text-white',
                                        selectedIds.length < 2
                                            ? 'bg-gray-300 cursor-not-allowed'
                                            : 'bg-green-600 hover:bg-green-700'
                                    )}
                                    disabled={selectedIds.length < 2}
                                    onClick={async () => {
                                        try {
                                            const res = await fetch('/api/conversations', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ userIds: selectedIds }),
                                            });
                                            if (!res.ok) throw new Error();
                                            const data: { conversationId: string } = await res.json();
                                            setShowNewGroup(false);
                                            router.replace(
                                                `${pathname}?convoId=${encodeURIComponent(
                                                    data.conversationId
                                                )}`
                                            );
                                            setSelectedIds([]);
                                            setSelectedUsers([]);
                                            setGroupQuery('');
                                            setGroupResults([]);
                                            loadByConversationId(data.conversationId);
                                            fetchConversations();
                                        } catch {
                                            alert('Failed to create group.');
                                        }
                                    }}
                                >
                                    Create Group
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ----------- MANAGE GROUP MODAL ----------- */}
                {showManage && activeConvoId && activeGroupMembers && (
                    <div
                        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
                        onClick={() => setShowManage(false)}
                    >
                        <div
                            className="bg-white p-5 rounded-xl shadow-lg w-[560px] max-w-[94vw]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-lg font-semibold">Manage Group</div>
                                <button
                                    className="text-sm text-gray-500 hover:text-black"
                                    onClick={() => setShowManage(false)}
                                >
                                    Close
                                </button>
                            </div>

                            {/* Rename */}
                            <div className="mb-5">
                                <div className="text-sm font-medium mb-1">Group name</div>
                                <div className="flex items-center gap-2">
                                    <input
                                        className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                                        placeholder="Optional group name"
                                        value={groupNameInput}
                                        onChange={(e) => setGroupNameInput(e.target.value)}
                                    />
                                    <button
                                        className="text-sm px-3 py-2 rounded border hover:bg-gray-50"
                                        onClick={async () => {
                                            try {
                                                const res = await fetch(
                                                    `/api/conversations/${encodeURIComponent(
                                                        activeConvoId
                                                    )}`,
                                                    {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            name: groupNameInput.trim() || null,
                                                        }),
                                                    }
                                                );
                                                if (!res.ok) throw new Error();
                                                const data = await res.json();
                                                setActiveGroupName(data.name ?? null);
                                                setShowManage(false);
                                                fetchConversations();
                                            } catch {
                                                alert('Failed to rename group.');
                                            }
                                        }}
                                    >
                                        Save
                                    </button>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Members will see a grey system line announcing the change.
                                </div>
                            </div>

                            {/* Members list with remove */}
                            <div className="mb-5">
                                <div className="text-sm font-medium mb-2">Members</div>
                                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                                    {activeGroupMembers.map((u) => (
                                        <div key={u.id} className="p-2 flex items-center gap-2">
                                            <Avatar user={u} size={28} />
                                            <button
                                                className="text-sm hover:underline text-left truncate flex-1"
                                                onClick={() => goToProfile(u)}
                                                title={displayName(u)}
                                            >
                                                {displayName(u)}
                                            </button>
                                            <button
                                                className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch(
                                                            `/api/conversations/${encodeURIComponent(
                                                                activeConvoId
                                                            )}/members?userId=${encodeURIComponent(u.id)}`,
                                                            { method: 'DELETE' }
                                                        );
                                                        if (!res.ok) throw new Error();
                                                        setActiveGroupMembers((prev) =>
                                                            prev ? prev.filter((m) => m.id !== u.id) : prev
                                                        );
                                                        fetchConversations();
                                                    } catch {
                                                        alert('Failed to remove user.');
                                                    }
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
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
                                <div className="mt-2 border rounded-md max-h-40 overflow-y-auto divide-y">
                                    {addLoading ? (
                                        <div className="p-2 text-sm text-gray-500">Searching…</div>
                                    ) : addResults.length === 0 ? (
                                        <div className="p-2 text-sm text-gray-400">No matches</div>
                                    ) : (
                                        addResults.map((u) => {
                                            const alreadyIn = !!activeGroupMembers.find(
                                                (m) => m.id === u.id
                                            );
                                            const chosen = addSelectedIds.includes(u.id);
                                            return (
                                                <label
                                                    key={u.id}
                                                    className={clsx(
                                                        'p-2 text-sm flex items-center gap-2 cursor-pointer',
                                                        alreadyIn ? 'opacity-50' : 'hover:bg-gray-50'
                                                    )}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        disabled={alreadyIn}
                                                        checked={chosen}
                                                        onChange={(e) =>
                                                            setAddSelectedIds((prev) =>
                                                                e.target.checked
                                                                    ? [...prev, u.id]
                                                                    : prev.filter((id) => id !== u.id)
                                                            )
                                                        }
                                                    />
                                                    <Avatar user={u} size={24} />
                                                    <div className="truncate">
                                                        {displayName(u)}
                                                    </div>
                                                    {alreadyIn && (
                                                        <span className="ml-auto text-[11px] text-gray-400">
                                                            In group
                                                        </span>
                                                    )}
                                                </label>
                                            );
                                        })
                                    )}
                                </div>

                                {addSelectedIds.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {addResults
                                            .filter((u) => addSelectedIds.includes(u.id))
                                            .map((u) => (
                                                <span
                                                    key={u.id}
                                                    className="px-2 py-1 text-xs bg-gray-100 rounded-full"
                                                >
                                                    {displayName(u)}
                                                </span>
                                            ))}
                                    </div>
                                )}

                                <div className="mt-2 flex justify-end">
                                    <button
                                        className={clsx(
                                            'text-sm px-3 py-2 rounded text-white',
                                            addSelectedIds.length === 0
                                                ? 'bg-gray-300 cursor-not-allowed'
                                                : 'bg-green-600 hover:bg-green-700'
                                        )}
                                        disabled={addSelectedIds.length === 0}
                                        onClick={async () => {
                                            try {
                                                const res = await fetch(
                                                    `/api/conversations/${encodeURIComponent(
                                                        activeConvoId
                                                    )}/members`,
                                                    {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ userIds: addSelectedIds }),
                                                    }
                                                );
                                                if (!res.ok) throw new Error();
                                                const data: { added: LiteUser[] } = await res.json();
                                                setActiveGroupMembers((prev) => [
                                                    ...(prev ?? []),
                                                    ...data.added,
                                                ]);
                                                setAddSelectedIds([]);
                                                setAddQuery('');
                                                setAddResults([]);
                                                fetchConversations();
                                            } catch {
                                                alert('Failed to add users.');
                                            }
                                        }}
                                    >
                                        Add selected
                                    </button>
                                </div>
                            </div>

                            {/* Danger zone */}
                            <div className="flex items-center justify-between">
                                <button
                                    className="text-sm px-3 py-2 rounded border hover:bg-gray-50"
                                    onClick={async () => {
                                        try {
                                            const res = await fetch(
                                                `/api/conversations/${encodeURIComponent(
                                                    activeConvoId
                                                )}`,
                                                {
                                                    method: 'DELETE',
                                                }
                                            );
                                            if (!res.ok) throw new Error();
                                            setShowManage(false);
                                            router.replace(pathname);
                                            setActiveConvoId(null);
                                            setActiveGroupMembers(null);
                                            setActiveGroupName(null);
                                            setMessages([]);
                                            fetchConversations();
                                        } catch {
                                            alert('Failed to leave/delete conversation.');
                                        }
                                    }}
                                >
                                    Leave conversation
                                </button>
                                <div className="text-xs text-gray-500">
                                    If you are the last member, the conversation will be deleted.
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ----------- POST MODAL (auto-resizing) ----------- */}
            {openPostId && (
                <SharedPostModal postId={openPostId} onClose={() => setOpenPostId(null)} />
            )}
        </>
    );
}
