"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserPlus, UserMinus, MessageSquare, Share2, Lock, ArrowLeft, Heart, MessageCircle } from "lucide-react";
import { useFollow } from "@/app/hooks/useFollow";
import FollowListModal from "@/components/FollowListModal";
import NotificationsModal from "@/components/NotificationsModal";
import clsx from "clsx";

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

export function GymProfile({ user, posts }: { user: any; posts?: BasicPost[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  const isOwnProfile = pathname === "/profile" || session?.user?.id === user.id;
  const gym = user.gymProfile;

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
  useEffect(() => { if (!isPending) setOptimisticRequested(false); }, [isPending]);

  const canViewPrivate = useMemo(
    () => isOwnProfile || isFollowing || !user.isPrivate,
    [isOwnProfile, isFollowing, user.isPrivate]
  );

  const [shareHint, setShareHint] = useState<string | null>(null);

  // posts
  const [gridPosts, setGridPosts] = useState<BasicPost[]>(posts ?? []);
  const [fullPosts, setFullPosts] = useState<FullPost[] | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!canViewPrivate) return;
      setPostsLoading(true);
      try {
        const res = await fetch(`/api/posts?authorId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: FullPost[] = await res.json();
        if (ignore) return;
        setFullPosts(data);
        setGridPosts(data.map(p => ({ id: p.id, title: p.title, imageUrl: p.imageUrl ?? null })));
      } finally {
        if (!ignore) setPostsLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [user.id, canViewPrivate]);

  // follow lists
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [list, setList] = useState<any[]>([]);

  const openFollowers = async () => {
    if (!canViewPrivate) return;
    setList([]); setShowFollowers(true);
    try {
      const res = await fetch(`/api/user/${user.id}/followers`, { cache: "no-store" });
      setList(res.ok ? await res.json() : []);
    } catch { setList([]); }
  };
  const openFollowing = async () => {
    if (!canViewPrivate) return;
    setList([]); setShowFollowing(true);
    try {
      const res = await fetch(`/api/user/${user.id}/following`, { cache: "no-store" });
      setList(res.ok ? await res.json() : []);
    } catch { setList([]); }
  };

  const handleFollowButton = async () => {
    if (loading) return;
    try {
      if (user.isPrivate) {
        if (isFollowing) await unfollow();
        else if (isPending || optimisticRequested) { setOptimisticRequested(false); await (cancelRequest?.() ?? unfollow()); }
        else { setOptimisticRequested(true); await (requestFollow?.() ?? follow()); }
      } else {
        if (isFollowing) await unfollow(); else await follow();
      }
    } finally { refreshCounts(); }
  };

  const handleMessage = () => router.push(`/messages?to=${encodeURIComponent(user.id)}`);

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${user.username || user.id}`;
    try { await navigator.clipboard.writeText(url); setShareHint("Profile link copied!"); }
    catch { setShareHint(url); }
    setTimeout(() => setShareHint(null), 2000);
  };

  const [showNotifications, setShowNotifications] = useState(false);

  const [viewMode, setViewMode] = useState<"grid" | "scroll">("grid");
  const [focusPostId, setFocusPostId] = useState<string | null>(null);

  const requested = user.isPrivate ? isPending || optimisticRequested : false;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-72 bg-white flex flex-col items-center pt-8">
        {/* avatar */}
        <div className="flex justify-center items-center mb-3">
          {user.image ? (
            <img src={user.image} alt={user.username || user.name || "Profile picture"} className="w-24 h-24 rounded-full object-cover border-4 border-white" />
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
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleFollowButton}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={user.isPrivate ? (isFollowing ? "Unfollow" : (requested ? "Requested" : "Request Follow")) : (isFollowing ? "Unfollow" : "Follow")}
                aria-label="Follow toggle"
              >
                {user.isPrivate ? (
                  isFollowing ? (<><UserMinus size={18} /><span>Unfollow</span></>)
                  : requested ? (<span className="text-xs font-medium">Requested</span>)
                  : (<><UserPlus size={18} /><span>Follow</span></>)
                ) : (
                  isFollowing ? (<><UserMinus size={18} /><span>Unfollow</span></>)
                  : (<><UserPlus size={18} /><span>Follow</span></>)
                )}
              </button>

              <button onClick={handleMessage} className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition" title="Message">
                <MessageSquare size={20} />
              </button>

              <button onClick={handleShare} className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition" title="Share profile">
                <Share2 size={20} />
              </button>
            </div>
            {shareHint && <div className="text-xs text-gray-500 mb-2">{shareHint}</div>}
          </>
        )}

        {/* bio & location */}
        <div className="text-center my-4">{gym?.bio || "this is my bio"}</div>
        <div className="text-center text-sm text-gray-600 mb-2">{user.location}</div>

        {/* stats */}
        <div className="flex flex-col gap-2 my-4 w-full px-6">
          <ProfileStat label="membership fee" value={gym?.fee ? `$${gym.fee}/mo` : "N/A"} />
          <button onClick={openFollowers} disabled={!canViewPrivate} className={clsx("flex justify-between", canViewPrivate ? "hover:underline" : "opacity-60 cursor-not-allowed")} title={canViewPrivate ? "View followers" : "Private"}>
            <span className="font-semibold">{followers}</span>
            <span className="text-gray-500">followers</span>
          </button>
          <button onClick={openFollowing} disabled={!canViewPrivate} className={clsx("flex justify-between", canViewPrivate ? "hover:underline" : "opacity-60 cursor-not-allowed")} title={canViewPrivate ? "View following" : "Private"}>
            <span className="font-semibold">{following}</span>
            <span className="text-gray-500">following</span>
          </button>
          <ProfileStat label="posts" value={canViewPrivate ? (fullPosts?.length ?? gridPosts.length) : "—"} />
        </div>

        {isOwnProfile && (
          <div className="flex flex-col gap-2 mb-6">
            <button className="w-44 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium" onClick={() => setShowNotifications(true)}>
              View Notifications
            </button>
            <button className="w-44 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium" onClick={() => router.push("/settings")}>
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
              <h3 className="text-lg font-semibold text-gray-800">Posts</h3>
              <div className="inline-flex rounded-full border bg-white p-1">
                <button className={clsx("px-3 py-1 text-sm rounded-full", viewMode === "grid" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100")} onClick={() => setViewMode("grid")}>Grid</button>
                <button className={clsx("px-3 py-1 text-sm rounded-full", viewMode === "scroll" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100")} onClick={() => setViewMode("scroll")}>Scroll</button>
              </div>
            </div>

            {postsLoading && !fullPosts && <div className="text-gray-500">Loading posts…</div>}

            {viewMode === "grid" ? (
              <MediaGrid posts={gridPosts} onOpen={(id) => setFocusPostId(id)} />
            ) : (
              <ScrollFeed
                posts={fullPosts ?? []}
                onOpen={(id) => setFocusPostId(id)}
                onLike={async (id) => {
                  try {
                    await fetch(`/api/posts/${encodeURIComponent(id)}/like`, { method: "POST" });
                    const res = await fetch(`/api/posts?authorId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
                    if (res.ok) setFullPosts(await res.json());
                  } catch {}
                }}
              />
            )}
          </>
        )}

        {focusPostId && (
          <div className="absolute inset-0 bg-[#f8f8f8] z-50">
            <div className="p-4">
              <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 text-sm" onClick={() => setFocusPostId(null)} title="Back to profile">
                <ArrowLeft size={16} />
                Back
              </button>
            </div>
            <div className="h-[calc(100%-56px)] px-6 pb-6">
              <iframe src={`/post/${encodeURIComponent(focusPostId)}`} className="w-full h-full rounded-xl bg-white shadow" />
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <FollowListModal open={showFollowers} title="Followers" items={list} onClose={() => setShowFollowers(false)} currentUserId={session?.user?.id} />
      <FollowListModal open={showFollowing} title="Following" items={list} onClose={() => setShowFollowing(false)} currentUserId={session?.user?.id} />
      <NotificationsModal open={showNotifications} onClose={() => setShowNotifications(false)} onAnyChange={refreshCounts} />
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
        <button key={post.id} className="bg-white rounded-lg flex items-center justify-center w-full h-56 overflow-hidden relative border hover:opacity-95" title={post.title} onClick={() => onOpen(post.id)}>
          {post.imageUrl ? <img src={post.imageUrl} alt={post.title} className="object-cover w-full h-full" /> : <span className="text-gray-600 font-semibold text-lg text-center px-4">{post.title}</span>}
        </button>
      ))}
    </div>
  );
}

function ScrollFeed({ posts, onOpen, onLike }: { posts: FullPost[]; onOpen: (id: string) => void; onLike: (id: string) => void | Promise<void>; }) {
  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  if (!posts || posts.length === 0) return <div className="text-gray-400 text-center py-12">No posts yet.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {posts.map((p) => (
        <article key={p.id} className="bg-white rounded-2xl shadow px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <button className="text-lg font-semibold text-gray-800 hover:underline" onClick={() => onOpen(p.id)} title="Open post">
                {p.title}
              </button>
              <div className="text-xs text-gray-500 mt-0.5">
                by{" "}
                {p.author?.username ? (
                  <Link href={`/u/${encodeURIComponent(p.author.username)}`} className="font-medium hover:underline">
                    {p.author.username}
                  </Link>
                ) : (
                  <span className="font-medium">Unknown</span>
                )}{" "}
                · {fmt(p.createdAt)}
              </div>
            </div>
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

          {p.content && <div className="text-gray-700 mt-3 whitespace-pre-wrap">{p.content}</div>}

          <div className="mt-3 flex items-center gap-4 text-sm">
            <button
              className={clsx("inline-flex items-center gap-1 transition", p.didLike ? "text-red-500" : "text-gray-500 hover:text-red-500")}
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
