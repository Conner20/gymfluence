'use client';

import { useCallback, useEffect, useState } from 'react';

type FollowState = {
    followers: number;
    following: number;
    isFollowing: boolean;
};

export function useFollow(targetUserId: string | undefined) {
    const [loading, setLoading] = useState(false);
    const [state, setState] = useState<FollowState>({
        followers: 0,
        following: 0,
        isFollowing: false,
    });

    const load = useCallback(async () => {
        if (!targetUserId) return;
        try {
            const res = await fetch(`/api/user/${encodeURIComponent(targetUserId)}/follow-state`, { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            setState({
                followers: Number(data.followers || 0),
                following: Number(data.following || 0),
                isFollowing: !!data.isFollowing,
            });
        } catch {/* noop */ }
    }, [targetUserId]);

    useEffect(() => { load(); }, [load]);

    const follow = useCallback(async () => {
        if (!targetUserId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/user/${encodeURIComponent(targetUserId)}/follow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'follow' }),
            });
            if (!res.ok) return;
            const data = await res.json();
            // IMPORTANT: trust the server's answer for accuracy
            setState({
                followers: Number(data.followers || 0),
                following: Number(data.following || 0),
                isFollowing: !!data.isFollowing,
            });
        } finally {
            setLoading(false);
        }
    }, [targetUserId]);

    const unfollow = useCallback(async () => {
        if (!targetUserId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/user/${encodeURIComponent(targetUserId)}/follow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unfollow' }),
            });
            if (!res.ok) return;
            const data = await res.json();
            setState({
                followers: Number(data.followers || 0),
                following: Number(data.following || 0),
                isFollowing: !!data.isFollowing,
            });
        } finally {
            setLoading(false);
        }
    }, [targetUserId]);

    return {
        loading,
        isFollowing: state.isFollowing,
        followers: state.followers,
        following: state.following,
        reload: load,
        follow,
        unfollow,
    };
}
