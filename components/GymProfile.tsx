"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  UserPlus,
  UserMinus,
  MessageSquare,
  Share2,
  Lock,
  ArrowLeft,
  Heart,
  MessageCircle,
  Star,
  X,
  Trash2,
} from "lucide-react";
import { useFollow } from "@/app/hooks/useFollow";
import FollowListModal from "@/components/FollowListModal";
import NotificationsModal from "@/components/NotificationsModal";
import CreatePost from "@/components/CreatePost";
import clsx from "clsx";

/* --------------------------- helpers & local UI --------------------------- */

async function postJSON<T>(url: string, payload: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data as T;
}
async function patchJSON<T>(url: string, payload: any): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data as T;
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className="text-2xl leading-none"
          style={{ background: "transparent" }}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

function RateGymModal({
  open,
  onClose,
  gymId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  gymId?: string;
  onSuccess?: () => void;
}) {
  const [stars, setStars] = React.useState(5);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    if (!gymId) return;
    setBusy(true);
    setErr(null);
    try {
      await postJSON("/api/ratings", {
        trainerId: null,
        gymId,
        stars,
        comment: comment.trim() || null,
      });
      onSuccess?.();
      onClose();
      alert("Rating submitted and awaiting approval.");
    } catch (e: any) {
      setErr(e.message || "Failed to submit rating");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center"
      role="dialog"
      aria-modal
    >
      <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Rate this gym</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/5">
            ✕
          </button>
        </div>
        <div className="mt-4">
          <StarPicker value={stars} onChange={setStars} />
        </div>
        <textarea
          className="w-full mt-4 p-3 border rounded"
          rows={4}
          placeholder="Optional comment…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {err && <p className="mt-2 text-red-600">{err}</p>}
        <div className="mt-4 flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded border">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

type PendingLite = {
  id: string;
  createdAt: string;
  rater?: { username: string | null; name: string | null } | null;
};
type HistoryRow = {
  id: string;
  createdAt: string;
  stars: number;
  comment: string | null;
  rater?: { username: string | null; name: string | null } | null;
};

function ManageGymRatingsModal({
  open,
  onClose,
  onApproved,
}: {
  open: boolean;
  onClose: () => void;
  onApproved?: (v: { newAverage: number; clients: number }) => void;
}) {
  const [tab, setTab] = React.useState<"pending" | "history">("pending");
  const [pending, setPending] = React.useState<PendingLite[]>([]);
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const who = (r: { rater?: { username: string | null; name: string | null } | null }) =>
    r?.rater?.username || r?.rater?.name || "Someone";

  useEffect(() => {
    if (!open) return;
    setTab("pending");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        if (tab === "pending") {
          const rows: PendingLite[] = await fetch("/api/ratings?pendingFor=gym", {
            cache: "no-store",
          }).then((r) => r.json());
          setPending(rows || []);
        } else {
          const rows: HistoryRow[] = await fetch("/api/ratings?historyFor=gym", {
            cache: "no-store",
          }).then((r) => r.json());
          setHistory(rows || []);
        }
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, tab]);

  async function act(id: string, action: "APPROVE" | "DECLINE") {
    try {
      const res = await patchJSON<any>(`/api/ratings/${id}`, { action });

      if (action === "DECLINE") {
        setPending((prev) => prev.filter((r) => r.id !== id));
        return;
      }

      // APPROVED: fetch full details, move to History, and show that tab
      try {
        const full: HistoryRow = await fetch(`/api/ratings/${id}`, {
          cache: "no-store",
        }).then((r) => r.json());
        setPending((prev) => prev.filter((r) => r.id !== id));
        setHistory((prev) => [full, ...prev]);
        setTab("history");
      } catch {
        setPending((prev) => prev.filter((r) => r.id !== id));
        setTab("history");
        const rows: HistoryRow[] = await fetch(
          "/api/ratings?historyFor=gym",
          { cache: "no-store" }
        ).then((r) => r.json());
        setHistory(rows || []);
      }

      if (res?.newAverage != null && res?.clients != null) {
        onApproved?.({ newAverage: res.newAverage, clients: res.clients });
      }
    } catch (e: any) {
      alert(e.message || "Failed");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center"
      role="dialog"
      aria-modal
    >
      <div className="bg-white rounded-xl p-5 w-full max-w-2xl shadow-xl relative">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ratings</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 inline-flex rounded-full border bg-white p-1">
          <button
            className={clsx(
              "px-3 py-1 text-sm rounded-full",
              tab === "pending"
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-100"
            )}
            onClick={() => setTab("pending")}
          >
            Pending
          </button>
          <button
            className={clsx(
              "px-3 py-1 text-sm rounded-full",
              tab === "history"
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-100"
            )}
            onClick={() => setTab("history")}
          >
            History
          </button>
        </div>

        {loading ? (
          <div className="mt-4 text-gray-600">Loading…</div>
        ) : err ? (
          <div className="mt-4 text-red-600">{err}</div>
        ) : tab === "pending" ? (
          <ul className="mt-4 space-y-3">
            {pending.length === 0 && (
              <div className="text-gray-600">Nothing pending.</div>
            )}
            {pending.map((r) => (
              <li key={r.id} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {who(r)} left a rating
                  </div>
                  <div className="text-xs text-neutral-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="px-3 py-1.5 rounded bg-black text-white"
                    onClick={() => act(r.id, "APPROVE")}
                  >
                    Approve
                  </button>
                  <button
                    className="px-3 py-1.5 rounded border"
                    onClick={() => act(r.id, "DECLINE")}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-4 space-y-3">
            {history.length === 0 && (
              <div className="text-gray-600">No ratings yet.</div>
            )}
            {history.map((r) => (
              <li key={r.id} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{who(r)}</div>
                  <div className="text-xs text-neutral-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="mt-1 text-xl">
                  {"★".repeat(r.stars)}
                  {"☆".repeat(Math.max(0, 5 - r.stars))}
                </div>
                {r.comment && (
                  <p className="mt-2 text-sm">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- types --------------------------------- */

type BasicPost = { id: string; title: string; imageUrl?: string | null };
type FullPost = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  author: { id: string; username: string | null; name: string | null } | null;
  likeCount: number;
  didLike: boolean;
  commentCount: number;
};

/* ------------------------------ main component ---------------------------- */

export function GymProfile({ user, posts }: { user: any; posts?: BasicPost[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [showRate, setShowRate] = useState(false);
  const [showManageRatings, setShowManageRatings] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);

  const isOwnProfile = pathname === "/profile" || session?.user?.id === user.id;
  const gym = user.gymProfile;

  // keep local rating/clients in sync after approvals
  const [localRating, setLocalRating] = useState<number | null>(
    gym?.rating ?? null
  );
  const [localClients, setLocalClients] = useState<number>(
    gym?.clients ?? 0
  );

  useEffect(() => {
    if (!isOwnProfile && searchParams?.get("rate") === "1") {
      setShowRate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    loading,
    isFollowing,
    isPending,
    followers,
    following,
    follow,
    unfollow,
    requestFollow,
    cancelRequest,
    refreshCounts,
  } = useFollow(user.id);

  const [optimisticRequested, setOptimisticRequested] = useState(false);
  useEffect(() => {
    if (!isPending) setOptimisticRequested(false);
  }, [isPending]);

  const canViewPrivate = useMemo(
    () => isOwnProfile || isFollowing || !user.isPrivate,
    [isOwnProfile, isFollowing, user.isPrivate]
  );

  const [shareHint, setShareHint] = useState<string | null>(null);

  // posts
  const [gridPosts, setGridPosts] = useState<BasicPost[]>(posts ?? []);
  const [fullPosts, setFullPosts] = useState<FullPost[] | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [focusPostId, setFocusPostId] = useState<string | null>(null);

  const refreshPosts = useCallback(async () => {
    if (!canViewPrivate) return;
    setPostsLoading(true);
    try {
      const res = await fetch(`/api/posts?authorId=${encodeURIComponent(user.id)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: FullPost[] = await res.json();
      setFullPosts(data);
      setGridPosts(
        data.map((p) => ({
          id: p.id,
          title: p.title,
          imageUrl: p.imageUrl ?? null,
        }))
      );
    } finally {
      setPostsLoading(false);
    }
  }, [user.id, canViewPrivate]);

  useEffect(() => {
    refreshPosts();
  }, [refreshPosts]);

  useEffect(() => {
    if (!isOwnProfile) return;
    const handler = () => {
      refreshPosts();
    };
    window.addEventListener("post-created", handler);
    return () => window.removeEventListener("post-created", handler);
  }, [isOwnProfile, refreshPosts]);

  const handleDeletePost = async (postId: string) => {
    if (!isOwnProfile) return;
    const ok = window.confirm("Delete this post? This cannot be undone.");
    if (!ok) return;

    try {
      const res = await fetch("/api/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Failed to delete post.");
        return;
      }

      setFullPosts((prev) => (prev ? prev.filter((p) => p.id !== postId) : prev));
      setGridPosts((prev) => prev.filter((p) => p.id !== postId));
      if (focusPostId === postId) setFocusPostId(null);
    } catch {
      alert("Failed to delete post.");
    }
  };

  // follow lists
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [list, setList] = useState<any[]>([]);

  const openFollowers = async () => {
    if (!canViewPrivate) return;
    setList([]);
    setShowFollowers(true);
    try {
      const res = await fetch(`/api/user/${user.id}/followers`, { cache: "no-store" });
      setList(res.ok ? await res.json() : []);
    } catch {
      setList([]);
    }
  };
  const openFollowing = async () => {
    if (!canViewPrivate) return;
    setList([]);
    setShowFollowing(true);
    try {
      const res = await fetch(`/api/user/${user.id}/following`, { cache: "no-store" });
      setList(res.ok ? await res.json() : []);
    } catch {
      setList([]);
    }
  };

  const handleFollowButton = async () => {
    if (loading) return;
    try {
      if (user.isPrivate) {
        if (isFollowing) await unfollow();
        else if (isPending || optimisticRequested) {
          setOptimisticRequested(false);
          await (cancelRequest?.() ?? unfollow());
        } else {
          setOptimisticRequested(true);
          await (requestFollow?.() ?? follow());
        }
      } else {
        if (isFollowing) await unfollow();
        else await follow();
      }
    } finally {
      refreshCounts();
    }
  };

  const handleMessage = () => router.push(`/messages?to=${encodeURIComponent(user.id)}`);

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${user.username || user.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareHint("Profile link copied!");
    } catch {
      setShareHint(url);
    }
    setTimeout(() => setShareHint(null), 2000);
  };

  const [showNotifications, setShowNotifications] = useState(false);

  const [viewMode, setViewMode] = useState<"grid" | "scroll">("grid");

  const requested = user.isPrivate ? isPending || optimisticRequested : false;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-72 h-screen bg-white flex flex-col items-center pt-8">
        {/* avatar */}
        <div className="flex justify-center items-center mb-3">
          {user.image ? (
            <img
              src={user.image}
              alt={user.username || user.name || "Profile picture"}
              className="w-24 h-24 rounded-full object-cover border-4 border-white"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white border border-gray-200 flex items-center justify-center">
              <span className="text-green-700 font-bold text-xl select-none text-center px-2 break-words leading-6">
                {user.username || user.name || "User"}
              </span>
            </div>
          )}
        </div>

        <h2 className="font-bold text-xl">{user.name}</h2>
        <div className="text-gray-500 text-sm mb-3">{user.role?.toLowerCase()}</div>

        {!isOwnProfile && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4 justify-center">
              <button
                onClick={handleFollowButton}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title={
                  user.isPrivate
                    ? isFollowing
                      ? "Unfollow"
                      : "Requested"
                    : isFollowing
                      ? "Unfollow"
                      : "Follow"
                }
                aria-label="Follow toggle"
              >
                {user.isPrivate ? (
                  isFollowing ? (
                    <>
                      <UserMinus size={18} />
                      <span>Unfollow</span>
                    </>
                  ) : requested ? (
                    <span className="text-xs font-medium">Requested</span>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      <span>Follow</span>
                    </>
                  )
                ) : isFollowing ? (
                  <>
                    <UserMinus size={18} />
                    <span>Unfollow</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    <span>Follow</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleMessage}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition"
                  title="Message"
                >
                  <MessageSquare size={20} />
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition"
                  title="Share profile"
                >
                  <Share2 size={20} />
                </button>

                <button
                  onClick={() => setShowRate(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition"
                  title="Rate this gym"
                >
                  <Star size={16} />
                </button>
              </div>
            </div>
            {shareHint && <div className="text-xs text-gray-500 mb-2">{shareHint}</div>}
          </>
        )}

        {/* bio & location */}
        <div className="text-center mt-6 mb-4 px-4">{gym?.bio || "this is my bio"}</div>
        <div className="text-center text-sm text-gray-600 mb-2">{user.location}</div>

        {/* stats */}
        <div className="flex flex-col gap-2 my-4 w-full px-6">
          <ProfileStat
            label="rating"
            value={localRating != null ? localRating.toFixed(1) : "N/A"}
          />
          <ProfileStat
            label="monthly fee"
            value={gym?.fee ? `$${gym.fee}/mo` : "N/A"}
          />
          <button
            onClick={openFollowers}
            disabled={!canViewPrivate}
            className={clsx(
              "flex justify-between",
              canViewPrivate ? "hover:underline" : "opacity-60 cursor-not-allowed"
            )}
            title={canViewPrivate ? "View followers" : "Private"}
          >
            <span className="font-semibold">{followers}</span>
            <span className="text-gray-500">followers</span>
          </button>
          <button
            onClick={openFollowing}
            disabled={!canViewPrivate}
            className={clsx(
              "flex justify-between",
              canViewPrivate ? "hover:underline" : "opacity-60 cursor-not-allowed"
            )}
            title={canViewPrivate ? "View following" : "Private"}
          >
            <span className="font-semibold">{following}</span>
            <span className="text-gray-500">following</span>
          </button>
          <ProfileStat
            label="posts"
            value={canViewPrivate ? (fullPosts?.length ?? gridPosts.length) : "—"}
          />
          <ProfileStat label="clients" value={localClients ?? 0} />
        </div>

        {isOwnProfile && (
          <div className="flex flex-col gap-2 mb-6">
            <button
              className="w-44 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium"
              onClick={() => setShowNotifications(true)}
            >
              View Notifications
            </button>
            <button
              className="w-44 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium"
              onClick={() => setShowManageRatings(true)}
            >
              Manage Ratings
            </button>
            <button
              className="w-44 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium"
              onClick={() => router.push("/settings")}
            >
              Edit Profile
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 relative bg-[#f8f8f8]">
        {!canViewPrivate ? (
          <PrivatePlaceholder />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-800">Posts</h3>
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => setShowCreatePost(true)}
                    className="px-3 py-1.5 rounded-full border text-xs font-medium bg-white hover:bg-gray-50 transition"
                  >
                    + Add Post
                  </button>
                )}
              </div>
              <div className="inline-flex rounded-full border bg-white p-1">
                <button
                  className={clsx(
                    "px-3 py-1 text-sm rounded-full",
                    viewMode === "grid"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                  onClick={() => setViewMode("grid")}
                >
                  Grid
                </button>
                <button
                  className={clsx(
                    "px-3 py-1 text-sm rounded-full",
                    viewMode === "scroll"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                  onClick={() => setViewMode("scroll")}
                >
                  Scroll
                </button>
              </div>
            </div>

            {postsLoading && !fullPosts && (
              <div className="text-gray-500">Loading posts…</div>
            )}

            {viewMode === "grid" ? (
              <MediaGrid posts={gridPosts} onOpen={(id) => setFocusPostId(id)} />
            ) : (
              <ScrollFeed
                posts={fullPosts ?? []}
                canDelete={isOwnProfile}
                onDelete={handleDeletePost}
                onOpen={(id) => setFocusPostId(id)}
                onLike={async (id) => {
                  try {
                    await fetch(
                      `/api/posts/${encodeURIComponent(id)}/like`,
                      { method: "POST" }
                    );
                    await refreshPosts();
                  } catch {
                    /* ignore */
                  }
                }}
              />
            )}
          </>
        )}

        {focusPostId && (
          <div className="absolute inset-0 bg-[#f8f8f8] z-50">
            <div className="p-4 flex items-center justify-between">
              <button
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 text-sm"
                onClick={() => setFocusPostId(null)}
                title="Back to profile"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              {isOwnProfile && (
                <button
                  className="p-2 rounded-full hover:bg-red-50 text-red-500"
                  title="Delete post"
                  onClick={() => handleDeletePost(focusPostId)}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <div className="h-[calc(100%-56px)] px-6 pb-6">
              <iframe
                src={`/post/${encodeURIComponent(focusPostId)}`}
                className="w-full h-full rounded-xl bg-white shadow"
              />
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <FollowListModal
        open={showFollowers}
        title="Followers"
        items={list}
        onClose={() => setShowFollowers(false)}
        currentUserId={session?.user?.id}
      />
      <FollowListModal
        open={showFollowing}
        title="Following"
        items={list}
        onClose={() => setShowFollowing(false)}
        currentUserId={session?.user?.id}
      />
      <NotificationsModal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        onAnyChange={refreshCounts}
      />

      <RateGymModal open={showRate} onClose={() => setShowRate(false)} gymId={gym?.id} />
      <ManageGymRatingsModal
        open={showManageRatings}
        onClose={() => setShowManageRatings(false)}
        onApproved={({ newAverage, clients }) => {
          setLocalRating(newAverage ?? null);
          setLocalClients(clients ?? 0);
        }}
      />

      {showCreatePost && <CreatePost onClose={() => setShowCreatePost(false)} />}
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="font-semibold">{value}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

function MediaGrid({ posts, onOpen }: { posts: BasicPost[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {posts.map((post) => (
        <button
          key={post.id}
          className="bg-white rounded-lg flex items-center justify-center w-full h-56 overflow-hidden relative border hover:opacity-95"
          title={post.title}
          onClick={() => onOpen(post.id)}
        >
          {post.imageUrl ? (
            <img
              src={post.imageUrl}
              alt={post.title}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="text-gray-600 font-semibold text-lg text-center px-4">
              {post.title}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function ScrollFeed({
  posts,
  onOpen,
  onLike,
  canDelete,
  onDelete,
}: {
  posts: FullPost[];
  onOpen: (id: string) => void;
  onLike: (id: string) => void | Promise<void>;
  canDelete: boolean;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  if (!posts || posts.length === 0)
    return <div className="text-gray-400 text-center py-12">No posts yet.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {posts.map((p) => (
        <article key={p.id} className="bg-white rounded-2xl shadow px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <button
                className="text-lg font-semibold text-gray-800 hover:underline"
                onClick={() => onOpen(p.id)}
                title="Open post"
              >
                {p.title}
              </button>
              <div className="text-xs text-gray-500 mt-0.5">
                by{" "}
                {p.author?.username ? (
                  <Link
                    href={`/u/${encodeURIComponent(p.author.username)}`}
                    className="font-medium hover:underline"
                  >
                    {p.author.username}
                  </Link>
                ) : (
                  <span className="font-medium">Unknown</span>
                )}{" "}
                · {fmt(p.createdAt)}
              </div>
            </div>
            {canDelete && (
              <button
                className="p-1.5 rounded-full hover:bg-red-50 text-red-500"
                title="Delete post"
                onClick={() => onDelete(p.id)}
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>

          {p.imageUrl && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt=""
                className="w-full max-h-[540px] object-contain rounded-lg border cursor-pointer"
                onClick={() => onOpen(p.id)}
              />
            </div>
          )}

          {p.content && (
            <div className="text-gray-700 mt-3 whitespace-pre-wrap">{p.content}</div>
          )}

          <div className="mt-3 flex items-center gap-4 text-sm">
            <button
              className={clsx(
                "inline-flex items-center gap-1 transition",
                p.didLike ? "text-red-500" : "text-gray-500 hover:text-red-500"
              )}
              onClick={() => onLike(p.id)}
              title={p.didLike ? "Unlike" : "Like"}
            >
              <Heart size={18} fill={p.didLike ? "currentColor" : "none"} />
              {p.likeCount}
            </button>

            <button
              className="inline-flex items-center gap-1 text-gray-500 hover:text-green-600"
              onClick={() => onOpen(p.id)}
              title="View comments"
            >
              <MessageCircle size={16} />
              {p.commentCount}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function PrivatePlaceholder() {
  return (
    <div className="w-full h-[60vh] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-500">
        <Lock size={20} />
        <span>This account is private. Follow to see their posts.</span>
      </div>
    </div>
  );
}
