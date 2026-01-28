'use client';

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldAlert, CheckSquare, Square } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AdminUser = {
    id: string;
    username: string | null;
    name: string | null;
    email: string | null;
    role: string | null;
    isPrivate: boolean;
    _count: {
        post: number;
        likes: number;
        comments: number;
        followers: number;
        following: number;
    };
};

type FetchState = "idle" | "loading" | "error";

export default function AdminUserManager() {
    const [query, setQuery] = useState("");
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [state, setState] = useState<FetchState>("idle");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    const selectedUsers = useMemo(
        () => users.filter((u) => selectedIds.includes(u.id)),
        [selectedIds, users],
    );

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
                                return (
                                    <li key={user.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSelect(user.id)}
                                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                                                isSelected
                                                    ? "border-black/40 bg-white"
                                                    : "border-transparent bg-white hover:border-black/10 dark:bg-white/5 dark:hover:border-white/20 dark:border-transparent"
                                            }`}
                                        >
                                            {isSelected ? (
                                                <CheckSquare className="h-4 w-4 text-black dark:text-white" />
                                            ) : (
                                                <Square className="h-4 w-4 text-black/40 dark:text-white/40" />
                                            )}
                                            <div>
                                                <p className="font-semibold text-black dark:text-white">
                                                    {user.username || user.name || "Unnamed"}
                                                </p>
                                                <p className="text-xs text-zinc-500 dark:text-white/60">
                                                    {user.email ?? "No email"} · {user.role ?? "No role"}
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
                                            <h3 className="text-2xl font-semibold text-black dark:text-white">
                                                {selectedUsers[0].username || selectedUsers[0].name || "Unnamed"}
                                            </h3>
                                            <p className="text-sm text-zinc-500 dark:text-white/60">
                                                {selectedUsers[0].email ?? "No email"} · {selectedUsers[0].role ?? "No role"}
                                            </p>
                                        </>
                                    )}
                                </div>

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
                                    <Input
                                        id="admin-password"
                                        type="password"
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
