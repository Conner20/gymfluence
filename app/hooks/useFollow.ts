// app/hooks/useFollow.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FollowState = {
    followers: number;
    following: number;
    isFollowing: boolean;
    requested: boolean; // pending
};

export function useFollow(targetUserId: string) {
    const [loading, setLoading] = useState(false);
    const [followers, setFollowers] = useState(0);
    const [following, setFollowing] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const mounted = useRef(true);

    const apply = (s: Partial<FollowState>) => {
        if (!mounted.current) return;
        if (s.followers !== undefined) setFollowers(s.followers);
        if (s.following !== undefined) setFollowing(s.following);
        if (s.isFollowing !== undefined) setIsFollowing(s.isFollowing);
        if (s.requested !== undefined) setIsPending(s.requested);
    };

    const fetchState = useCallback(async () => {
        try {
            const res = await fetch(`/api/user/${encodeURIComponent(targetUserId)}/follow-state`, { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            apply({
                followers: data.followers ?? 0,
                following: data.following ?? 0,
                isFollowing: !!data.isFollowing,
                requested: !!data.requested,
            });
        } catch {
            // ignore
        }
    }, [targetUserId]);

    useEffect(() => {
        mounted.current = true;
        fetchState();
        return () => {
            mounted.current = false;
        };
    }, [fetchState]);

    const refreshCounts = useCallback(() => fetchState(), [fetchState]);

    const postFollow = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/user/${encodeURIComponent(targetUserId)}/follow`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json().catch(() => ({}));
            apply({
                followers: data.followers ?? followers,
                following: data.following ?? following,
                isFollowing: !!data.isFollowing,
                requested: !!data.requested,
            });
        } finally {
            setLoading(false);
        }
    }, [targetUserId, followers, following]);

    const delFollow = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/user/${encodeURIComponent(targetUserId)}/follow`, {
                method: "DELETE",
            });
            const data = await res.json().catch(() => ({}));
            apply({
                followers: data.followers ?? followers,
                following: data.following ?? following,
                isFollowing: !!data.isFollowing,
                requested: !!data.requested,
            });
        } finally {
            setLoading(false);
        }
    }, [targetUserId, followers, following]);

    // Public follow (or private when not pending yet)
    const follow = useCallback(() => postFollow(), [postFollow]);

    // Unfollow (ACCEPTED -> none)
    const unfollow = useCallback(() => delFollow(), [delFollow]);

    // Private: send follow request (PENDING)
    const requestFollow = useCallback(() => postFollow(), [postFollow]);

    // Private: cancel follow request (PENDING -> none)
    const cancelRequest = useCallback(() => delFollow(), [delFollow]);

    return {
        loading,
        followers,
        following,
        isFollowing,
        isPending,
        follow,
        unfollow,
        requestFollow,
        cancelRequest,
        refreshCounts,
    };
}
