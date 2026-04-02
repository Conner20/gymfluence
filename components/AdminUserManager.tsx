'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldAlert, CheckSquare, Square, ChevronDown, ChevronRight, RefreshCw, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

type AdminUser = {
    id: string;
    username: string | null;
    name: string | null;
    email: string | null;
    role: string | null;
    isAdmin: boolean;
    isConfiguredAdmin: boolean;
    hasAdminAccess: boolean;
    isPrivate: boolean;
    lastActiveAt: string | null;
    gymProfile: {
        name: string;
        address: string;
        phone: string;
        website: string;
        fee: number;
        isVerified: boolean;
    } | null;
    _count: {
        post: number;
        likes: number;
        comments: number;
        followers: number;
        following: number;
    };
};

type FetchState = "idle" | "loading" | "error";

type AdminPost = {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    imageUrl: string | null;
};

type AdminComment = {
    id: string;
    content: string;
    createdAt: string;
    postId: string;
};

type AdminActivityEntry = {
    id: string;
    path: string;
    createdAt: string;
};

function getRelativeActivityParts(value: string | null) {
    if (!value) return { compact: "-", full: "No activity yet" };

    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    if (Number.isNaN(diff) || diff < 0) return { compact: "0h", full: "Just now" };

    const hour = 1000 * 60 * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;

    if (diff >= year) {
        const count = Math.floor(diff / year);
        return { compact: `${count}y`, full: `${count}y ago` };
    }
    if (diff >= month) {
        const count = Math.floor(diff / month);
        return { compact: `${count}mo`, full: `${count}mo ago` };
    }
    if (diff >= week) {
        const count = Math.floor(diff / week);
        return { compact: `${count}w`, full: `${count}w ago` };
    }
    if (diff >= day) {
        const count = Math.floor(diff / day);
        return { compact: `${count}d`, full: `${count}d ago` };
    }

    const count = Math.max(1, Math.floor(diff / hour));
    return { compact: `${count}h`, full: `${count}h ago` };
}

function formatRelativeActivity(value: string | null) {
    if (!value) return "No activity yet";

    return getRelativeActivityParts(value).full;
}

export default function AdminUserManager() {
    const [query, setQuery] = useState("");
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [canManageUsers, setCanManageUsers] = useState(false);
    const [state, setState] = useState<FetchState>("idle");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [updatingPrivileges, setUpdatingPrivileges] = useState(false);
    const [verifyingGym, setVerifyingGym] = useState(false);
    const [posts, setPosts] = useState<AdminPost[]>([]);
    const [comments, setComments] = useState<AdminComment[]>([]);
    const [activity, setActivity] = useState<AdminActivityEntry[]>([]);
    const [postsState, setPostsState] = useState<FetchState>("idle");
    const [commentsState, setCommentsState] = useState<FetchState>("idle");
    const [activityState, setActivityState] = useState<FetchState>("idle");
    const [postsPanelOpen, setPostsPanelOpen] = useState(false);
    const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
    const [activityPanelOpen, setActivityPanelOpen] = useState(false);

    const selectedUsers = useMemo(
        () => users.filter((u) => selectedIds.includes(u.id)),
        [selectedIds, users],
    );

    const activeUser = selectedUsers.length === 1 ? selectedUsers[0] : null;

    const fetchUsers = async () => {
        setState("loading");
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`, {
                cache: "no-store",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                const errMsg =
                    data?.error ||
                    (res.status === 401 || res.status === 403
                        ? "You do not have permission to view users."
                        : "Unable to load users");
                throw new Error(errMsg);
            }
            const data = await res.json();
            setUsers(data?.users ?? []);
            setCanManageUsers(Boolean(data?.canManageUsers));
            setState("idle");
            if (data?.users?.length) {
                const ids = data.users.map((u: AdminUser) => u.id);
                setSelectedIds((prev) => prev.filter((id) => ids.includes(id)));
            } else {
                setSelectedIds([]);
            }
        } catch (err) {
            console.error(err);
            setState("error");
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Unable to load users.",
            });
        }
    };

    useEffect(() => {
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setPosts([]);
        setComments([]);
        setActivity([]);
        setMessage(null);
        setPostsState("idle");
        setCommentsState("idle");
        setActivityState("idle");
        setPostsPanelOpen(false);
        setCommentsPanelOpen(false);
        setActivityPanelOpen(false);
    }, [activeUser?.id]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchUsers();
    };

    const handleToggleSelect = (userId: string) => {
        setSelectedIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleDelete = async () => {
        if (!selectedUsers.length || !password) {
            setMessage({ type: "error", text: "Select at least one user and enter your password." });
            return;
        }
        setDeleting(true);
        setMessage(null);
        try {
            for (const user of selectedUsers) {
                const res = await fetch("/api/user/delete", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        password,
                        targetUserId: user.id,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data?.message || `Failed to delete ${user.username || user.name || "user"}`);
                }
            }
            setMessage({
                type: "success",
                text:
                    selectedUsers.length === 1
                        ? "User deleted."
                        : `${selectedUsers.length} users deleted.`,
            });
            setPassword("");
            await fetchUsers();
        } catch (err) {
            console.error(err);
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Failed to delete user.",
            });
        } finally {
            setDeleting(false);
        }
    };

    const fetchPosts = async () => {
        if (!activeUser) return;
        setPostsState("loading");
        try {
            const res = await fetch(`/api/admin/users/${activeUser.id}/posts`, { cache: "no-store" });
            if (!res.ok) throw new Error("Unable to load posts.");
            const data = await res.json();
            setPosts(data?.posts ?? []);
            setPostsState("idle");
        } catch (err) {
            console.error(err);
            setPostsState("error");
        }
    };

    const fetchComments = async () => {
        if (!activeUser) return;
        setCommentsState("loading");
        try {
            const res = await fetch(`/api/admin/users/${activeUser.id}/comments`, { cache: "no-store" });
            if (!res.ok) throw new Error("Unable to load comments.");
            const data = await res.json();
            setComments(data?.comments ?? []);
            setCommentsState("idle");
        } catch (err) {
            console.error(err);
            setCommentsState("error");
        }
    };

    const fetchActivity = async () => {
        if (!activeUser) return;
        setActivityState("loading");
        try {
            const res = await fetch(`/api/admin/users/${activeUser.id}/activity`, { cache: "no-store" });
            if (!res.ok) throw new Error("Unable to load activity.");
            const data = await res.json();
            setActivity(data?.activity ?? []);
            setActivityState("idle");
        } catch (err) {
            console.error(err);
            setActivityState("error");
        }
    };

    const togglePostsPanel = () => {
        const next = !postsPanelOpen;
        setPostsPanelOpen(next);
        if (next && postsState === "idle" && posts.length === 0) {
            fetchPosts();
        }
    };

    const toggleCommentsPanel = () => {
        const next = !commentsPanelOpen;
        setCommentsPanelOpen(next);
        if (next && commentsState === "idle" && comments.length === 0) {
            fetchComments();
        }
    };

    const toggleActivityPanel = () => {
        const next = !activityPanelOpen;
        setActivityPanelOpen(next);
        if (next && activityState === "idle" && activity.length === 0) {
            fetchActivity();
        }
    };

    const requirePassword = () => {
        if (!password) {
            setMessage({ type: "error", text: "Enter your password to perform this action." });
            return false;
        }
        return true;
    };

    const deletePost = async (postId: string) => {
        if (!activeUser || !requirePassword()) return;
        try {
            const res = await fetch(`/api/admin/users/${activeUser.id}/posts`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, postId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to delete post.");
            setMessage({ type: "success", text: "Post deleted." });
            fetchPosts();
        } catch (err) {
            console.error(err);
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to delete post." });
        }
    };

    const deleteComment = async (commentId: string) => {
        if (!activeUser || !requirePassword()) return;
        try {
            const res = await fetch(`/api/admin/users/${activeUser.id}/comments`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, commentId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to delete comment.");
            setMessage({ type: "success", text: "Comment deleted." });
            fetchComments();
        } catch (err) {
            console.error(err);
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Failed to delete comment.",
            });
        }
    };

    const updatePrivileges = async (nextIsAdmin: boolean) => {
        if (!activeUser || !requirePassword()) return;
        setUpdatingPrivileges(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/users/${activeUser.id}/privileges`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, isAdmin: nextIsAdmin }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.message || "Failed to update privileges.");
            }

            setUsers((prev) => {
                return prev.map((user) => {
                    if (user.id !== activeUser.id) return user;

                    return {
                        ...user,
                        isAdmin: nextIsAdmin,
                        hasAdminAccess: data?.user?.hasAdminAccess ?? nextIsAdmin,
                    };
                });
            });
            setMessage({
                type: "success",
                text: data?.message || "Privileges updated.",
            });
        } catch (err) {
            console.error(err);
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Failed to update privileges.",
            });
        } finally {
            setUpdatingPrivileges(false);
        }
    };

    const verifyGym = async () => {
        if (!activeUser || activeUser.role !== "GYM" || activeUser.gymProfile?.isVerified || !requirePassword()) return;
        setVerifyingGym(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/users/${activeUser.id}/verify`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.message || "Failed to verify gym.");
            }

            setUsers((prev) =>
                prev.map((user) =>
                    user.id === activeUser.id
                        ? {
                              ...user,
                              gymProfile: user.gymProfile
                                  ? { ...user.gymProfile, isVerified: true }
                                  : user.gymProfile,
                          }
                        : user
                )
            );
            setMessage({ type: "success", text: data?.message || "Gym verified." });
        } catch (err) {
            console.error(err);
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Failed to verify gym.",
            });
        } finally {
            setVerifyingGym(false);
        }
    };

    return (
        <div className="w-full max-w-5xl space-y-6">
            <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-lg shadow-black/10 dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/20">
                <h2 className="text-2xl font-semibold text-black mb-4 dark:text-white">User Directory</h2>
                <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:max-w-xl">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by username, name, or email"
                        className="bg-white text-black placeholder:text-zinc-400 border border-black/10 dark:bg-black/60 dark:text-white dark:border-white/20 dark:placeholder:text-white/40"
                    />
                    <Button type="submit" className="bg-black text-white hover:bg-zinc-800 w-full sm:w-auto dark:bg-white/90 dark:text-black dark:hover:bg-white">
                        Search
                    </Button>
                </form>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-black/5 bg-zinc-50 p-4 max-h-[480px] overflow-y-auto scrollbar-slim dark:border-white/10 dark:bg-black/40">
                        {state === "loading" && (
                            <div className="flex items-center justify-center py-12 text-zinc-500 dark:text-white/70">
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                Loading users…
                            </div>
                        )}
                        {state === "error" && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200">
                                Unable to load users. Please try again.
                            </div>
                        )}
                        {state === "idle" && users.length === 0 && (
                            <p className="text-sm text-zinc-500 text-center py-6 dark:text-white/60">No users found.</p>
                        )}
                        <ul className="space-y-2">
                            {users.map((user) => {
                                const isSelected = selectedIds.includes(user.id);
                                const activityParts = getRelativeActivityParts(user.lastActiveAt);
                                const isUnverifiedGym = user.role === "GYM" && !user.gymProfile?.isVerified;
                                return (
                                    <li key={user.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSelect(user.id)}
                                            className={`group flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition sm:items-center sm:justify-between ${
                                                isSelected
                                                    ? "border-black/40 bg-white dark:bg-white/10"
                                                    : isUnverifiedGym
                                                        ? "border-red-200 bg-red-50 hover:border-red-300 dark:border-red-500/30 dark:bg-red-500/10 dark:hover:border-red-400/40"
                                                        : "border-transparent bg-white hover:border-black/10 dark:bg-white/5 dark:hover:border-white/20 dark:border-transparent"
                                            }`}
                                        >
                                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                                {isSelected ? (
                                                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-black dark:text-white sm:mt-0" />
                                                ) : (
                                                    <Square className="mt-0.5 h-4 w-4 shrink-0 text-black/40 dark:text-white/40 sm:mt-0" />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <p className="min-w-0 flex-1 truncate font-semibold text-black dark:text-white">
                                                            {user.username || user.name || "Unnamed"}
                                                        </p>
                                                        <p className="shrink-0 text-xs font-medium text-zinc-600 dark:text-white/70 sm:hidden">
                                                            {activityParts.compact}
                                                        </p>
                                                    </div>
                                                    <p className="truncate text-xs text-zinc-500 dark:text-white/60">
                                                        {user.email ?? "No email"} · {user.role ?? "No role"}
                                                    </p>
                                                    {isUnverifiedGym && (
                                                        <p className="mt-0.5 text-[11px] font-medium text-red-600 dark:text-red-300">
                                                            Unverified gym
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="hidden w-full shrink-0 text-right sm:block sm:w-auto">
                                                <p className="hidden text-[11px] uppercase tracking-wide text-zinc-400 dark:text-white/40 sm:block">
                                                    Last active
                                                </p>
                                                <p className="text-xs font-medium text-zinc-600 dark:text-white/70">
                                                    {activityParts.full}
                                                </p>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div className="rounded-xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-black/40">
                        {selectedUsers.length ? (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-white/60">
                                        Selected {selectedUsers.length} {selectedUsers.length === 1 ? "user" : "users"}
                                    </p>
                                    {selectedUsers.length === 1 && (
                                        <>
                                            <Link
                                                href={selectedUsers[0].username ? `/u/${encodeURIComponent(selectedUsers[0].username!)}` : "/profile"}
                                                className="text-2xl font-semibold text-black dark:text-white hover:underline decoration-2 decoration-green-600"
                                                prefetch={false}
                                            >
                                                {selectedUsers[0].username || selectedUsers[0].name || "Unnamed"}
                                            </Link>
                                            <p className="text-sm text-zinc-500 dark:text-white/60">
                                                {selectedUsers[0].email ?? "No email"} · {selectedUsers[0].role ?? "No role"}
                                            </p>
                                            <p className="mt-1 text-xs text-zinc-500 dark:text-white/60">
                                                Last active {formatRelativeActivity(selectedUsers[0].lastActiveAt)}
                                            </p>
                                            {selectedUsers[0].role === "GYM" && (
                                                <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                                    selectedUsers[0].gymProfile?.isVerified
                                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                                        : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                                                }`}>
                                                    {selectedUsers[0].gymProfile?.isVerified ? "Verified gym" : "Unverified gym"}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>

                                {activeUser && (
                                    activeUser.role === "GYM" && activeUser.gymProfile ? (
                                        <div className="rounded-xl border border-black/10 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-medium text-black dark:text-white">Gym onboarding details</p>
                                                    <p className="mt-1 text-xs text-zinc-500 dark:text-white/60">
                                                        Organization details submitted during gym onboarding.
                                                    </p>
                                                </div>
                                                {!activeUser.gymProfile.isVerified && (
                                                    <Button
                                                        type="button"
                                                        className="shrink-0 bg-green-700 text-white hover:bg-green-800"
                                                        disabled={verifyingGym || !password}
                                                        onClick={verifyGym}
                                                    >
                                                        {verifyingGym ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Verifying…
                                                            </>
                                                        ) : (
                                                            "Verify"
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                            {!activeUser.gymProfile.isVerified && (
                                                <p className="mt-2 text-xs text-zinc-500 dark:text-white/60">
                                                    Verify this gym to remove the red highlight from the directory.
                                                </p>
                                            )}
                                            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                                                <div className="rounded-lg border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-black/40">
                                                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-white/60">Organization name</dt>
                                                    <dd className="mt-1 text-sm font-medium text-black dark:text-white">{activeUser.gymProfile.name}</dd>
                                                </div>
                                                <div className="rounded-lg border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-black/40">
                                                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-white/60">Monthly membership fee</dt>
                                                    <dd className="mt-1 text-sm font-medium text-black dark:text-white">${activeUser.gymProfile.fee}/mo</dd>
                                                </div>
                                                <div className="rounded-lg border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-black/40 sm:col-span-2">
                                                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-white/60">Address</dt>
                                                    <dd className="mt-1 text-sm font-medium text-black dark:text-white">{activeUser.gymProfile.address}</dd>
                                                </div>
                                                <div className="rounded-lg border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-black/40">
                                                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-white/60">Phone</dt>
                                                    <dd className="mt-1 text-sm font-medium text-black dark:text-white">{activeUser.gymProfile.phone}</dd>
                                                </div>
                                                <div className="rounded-lg border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-black/40">
                                                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-white/60">Website</dt>
                                                    <dd className="mt-1 min-w-0 text-sm font-medium text-black dark:text-white break-all">{activeUser.gymProfile.website}</dd>
                                                </div>
                                            </dl>
                                        </div>
                                    ) : null
                                )}

                                {activeUser && (
                                    <div className="rounded-xl border border-black/10 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-medium text-black dark:text-white">Privileges</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-black dark:border-white/10 dark:bg-black/40 dark:text-white">
                                                        User
                                                    </span>
                                                    {activeUser.hasAdminAccess && (
                                                        <span className="rounded-full border border-emerald-600/20 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                            Admin
                                                        </span>
                                                    )}
                                                </div>
                                                {activeUser.isConfiguredAdmin ? (
                                                    <p className="mt-2 text-xs text-zinc-500 dark:text-white/60">
                                                        This admin is managed by environment configuration.
                                                    </p>
                                                ) : !canManageUsers ? (
                                                    <p className="mt-2 text-xs text-zinc-500 dark:text-white/60">
                                                        Only the super admin can change user privileges.
                                                    </p>
                                                ) : (
                                                    <p className="mt-2 text-xs text-zinc-500 dark:text-white/60">
                                                        Promote or demote this user from the directory.
                                                    </p>
                                                )}
                                            </div>
                                            {canManageUsers && !activeUser.isConfiguredAdmin && (
                                                <div className="group relative shrink-0">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="shrink-0"
                                                        disabled={updatingPrivileges || !password || !canManageUsers}
                                                        onClick={() => updatePrivileges(!activeUser.hasAdminAccess)}
                                                    >
                                                        {updatingPrivileges ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Saving…
                                                            </>
                                                        ) : activeUser.hasAdminAccess ? (
                                                            "Remove admin"
                                                        ) : (
                                                            "Make admin"
                                                        )}
                                                    </Button>
                                                    {!updatingPrivileges ? !canManageUsers ? (
                                                        <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden min-w-52 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-zinc-600 shadow-lg group-hover:block dark:border-white/10 dark:bg-neutral-900 dark:text-white/70">
                                                            Only the super admin can change user privileges.
                                                        </div>
                                                    ) : !password ? (
                                                        <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden min-w-52 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-zinc-600 shadow-lg group-hover:block dark:border-white/10 dark:bg-neutral-900 dark:text-white/70">
                                                            Enter your password to use this button.
                                                        </div>
                                                    ) : null : null}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeUser && (
                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={toggleActivityPanel}
                                            className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-left text-sm font-medium text-black dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                {activityPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                Activity log
                                            </div>
                                            <span className="text-xs text-zinc-500 dark:text-white/60">
                                                {activityState === "loading" ? "Loading…" : activity.length ? `${activity.length} entries` : "Tap to load"}
                                            </span>
                                        </button>
                                        {activityPanelOpen && (
                                            <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-black/40">
                                                <div className="mb-3 flex items-center justify-between text-sm">
                                                    <span className="text-zinc-500 dark:text-white/60">
                                                        Navigation log
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={fetchActivity}
                                                        className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-black dark:text-white/70 dark:hover:text-white"
                                                    >
                                                        <RefreshCw className="h-3 w-3" />
                                                        Refresh
                                                    </button>
                                                </div>
                                                {activityState === "error" && (
                                                    <p className="text-xs text-red-500 dark:text-red-200">Unable to load activity.</p>
                                                )}
                                                {activityPanelOpen && activityState === "loading" && (
                                                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-white/70">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Loading…
                                                    </div>
                                                )}
                                                {activityPanelOpen && activityState === "idle" && activity.length === 0 && (
                                                    <p className="text-xs text-zinc-500 dark:text-white/60">No activity found.</p>
                                                )}
                                                {activity.length > 0 && (
                                                    <div className="scrollbar-slim max-h-[320px] overflow-y-auto rounded-lg border border-black/5 bg-[#fcfcfc] p-3 font-mono text-xs text-zinc-700 dark:border-white/10 dark:bg-[#060606] dark:text-white/75">
                                                        {activity.map((entry) => (
                                                            <div
                                                                key={entry.id}
                                                                className="grid grid-cols-[176px_1fr] gap-3 border-b border-black/5 py-2 last:border-b-0 dark:border-white/5"
                                                            >
                                                                <span className="text-zinc-500 dark:text-white/40">
                                                                    {new Date(entry.createdAt).toLocaleString()}
                                                                </span>
                                                                <span className="break-all text-emerald-700 dark:text-emerald-400">
                                                                    GET {entry.path}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={togglePostsPanel}
                                            className="w-full flex items-center justify-between rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-left text-sm font-medium text-black dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                {postsPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                Posts
                                            </div>
                                            <span className="text-xs text-zinc-500 dark:text-white/60">
                                                {postsState === "loading" ? "Loading…" : posts.length ? `${posts.length} loaded` : "Tap to load"}
                                            </span>
                                        </button>
                                        {postsPanelOpen && (
                                            <div className="rounded-xl border border-black/10 bg-white p-3 space-y-3 dark:border-white/10 dark:bg-black/40">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-zinc-500 dark:text-white/60">
                                                        Latest posts
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={fetchPosts}
                                                        className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-black dark:text-white/70 dark:hover:text-white"
                                                    >
                                                        <RefreshCw className="h-3 w-3" />
                                                        Refresh
                                                    </button>
                                                </div>
                                                {postsState === "error" && (
                                                    <p className="text-xs text-red-500 dark:text-red-200">Unable to load posts.</p>
                                                )}
                                                {postsPanelOpen && postsState === "loading" && (
                                                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-white/70">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Loading…
                                                    </div>
                                                )}
                                                {postsPanelOpen && postsState === "idle" && posts.length === 0 && (
                                                    <p className="text-xs text-zinc-500 dark:text-white/60">No posts found.</p>
                                                )}
                                                {posts.map((post) => (
                                                    <div key={post.id} className="rounded-lg border border-black/5 bg-zinc-50 p-3 text-sm text-black dark:border-white/10 dark:bg-white/5 dark:text-white">
                                                        <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-white/60">
                                                            <span>{new Date(post.createdAt).toLocaleString()}</span>
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center gap-1 text-red-600 dark:text-white/60 dark:hover:text-red-400"
                                                                onClick={() => deletePost(post.id)}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                        <p className="mt-1 font-semibold">{post.title || "Untitled"}</p>
                                                        <p className="text-xs text-zinc-600 dark:text-white/70 line-clamp-2">
                                                            {post.content || "No content"}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={toggleCommentsPanel}
                                            className="w-full flex items-center justify-between rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-left text-sm font-medium text-black dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                {commentsPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                Comments
                                            </div>
                                            <span className="text-xs text-zinc-500 dark:text-white/60">
                                                {commentsState === "loading" ? "Loading…" : comments.length ? `${comments.length} loaded` : "Tap to load"}
                                            </span>
                                        </button>
                                        {commentsPanelOpen && (
                                            <div className="rounded-xl border border-black/10 bg-white p-3 space-y-3 dark:border-white/10 dark:bg-black/40">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-zinc-500 dark:text-white/60">Latest comments</span>
                                                    <button
                                                        type="button"
                                                        onClick={fetchComments}
                                                        className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-black dark:text-white/70 dark:hover:text-white"
                                                    >
                                                        <RefreshCw className="h-3 w-3" />
                                                        Refresh
                                                    </button>
                                                </div>
                                                {commentsState === "error" && (
                                                    <p className="text-xs text-red-500 dark:text-red-200">Unable to load comments.</p>
                                                )}
                                                {commentsPanelOpen && commentsState === "loading" && (
                                                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-white/70">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Loading…
                                                    </div>
                                                )}
                                                {commentsPanelOpen && commentsState === "idle" && comments.length === 0 && (
                                                    <p className="text-xs text-zinc-500 dark:text-white/60">No comments found.</p>
                                                )}
                                                {comments.map((comment) => (
                                                    <div key={comment.id} className="rounded-lg border border-black/5 bg-zinc-50 p-3 text-sm text-black dark:border-white/10 dark:bg-white/5 dark:text-white">
                                                        <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-white/60">
                                                            <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center gap-1 text-red-600 dark:text-white/60 dark:hover:text-red-400"
                                                                onClick={() => deleteComment(comment.id)}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-zinc-600 dark:text-white/70 mt-1">
                                                            On post ID: {comment.postId}
                                                        </p>
                                                        <p className="mt-1 text-sm">{comment.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedUsers.length === 1 && (
                                    <dl className="grid grid-cols-2 gap-3 text-sm text-zinc-600 dark:text-white/70">
                                        <div className="rounded-lg border border-black/5 p-3 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
                                            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-white/60">Posts</dt>
                                            <dd className="text-xl font-semibold text-black dark:text-white">
                                                {selectedUsers[0]._count.post}
                                            </dd>
                                        </div>
                                        <div className="rounded-lg border border-black/5 p-3 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
                                            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-white/60">Comments</dt>
                                            <dd className="text-xl font-semibold text-black dark:text-white">
                                                {selectedUsers[0]._count.comments}
                                            </dd>
                                        </div>
                                        <div className="rounded-lg border border-black/5 p-3 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
                                            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-white/60">Followers</dt>
                                            <dd className="text-xl font-semibold text-black dark:text-white">
                                                {selectedUsers[0]._count.followers}
                                            </dd>
                                        </div>
                                        <div className="rounded-lg border border-black/5 p-3 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
                                            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-white/60">Following</dt>
                                            <dd className="text-xl font-semibold text-black dark:text-white">
                                                {selectedUsers[0]._count.following}
                                            </dd>
                                        </div>
                                    </dl>
                                )}
                                {selectedUsers.length > 1 && (
                                    <p className="text-sm text-zinc-500 dark:text-white/60">
                                        Summary metrics available when a single user is selected.
                                    </p>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-black dark:text-white" htmlFor="admin-password">
                                        Confirm your password
                                    </label>
                                    <PasswordInput
                                        id="admin-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password to confirm"
                                        className="bg-white text-black border border-black/10 placeholder:text-zinc-400 dark:bg-black/60 dark:text-white dark:border-white/20 dark:placeholder:text-white/40"
                                    />
                                </div>

                                {message && (
                                    <div
                                        className={`rounded-xl border px-3 py-2 text-sm ${
                                            message.type === "success"
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-100"
                                                : "border-red-200 bg-red-50 text-red-800 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200"
                                        }`}
                                    >
                                        {message.text}
                                    </div>
                                )}

                                {canManageUsers && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        className="w-full bg-red-600 text-white hover:bg-red-700"
                                        disabled={deleting || !password || !selectedUsers.length}
                                        onClick={handleDelete}
                                    >
                                        {deleting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Deleting…
                                            </>
                                        ) : (
                                            <>
                                                <ShieldAlert className="h-4 w-4 mr-2" />
                                                Delete selected users
                                            </>
                                        )}
                                    </Button>
                                )}
                                {!canManageUsers && (
                                    <p className="text-xs text-zinc-500 dark:text-white/60">
                                        Only the super admin can delete users or change user privileges.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-zinc-500 dark:text-white/60">Select a user to view details.</p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
