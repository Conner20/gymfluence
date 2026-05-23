'use client';

import { useEffect, useState } from 'react';

type Role = 'TRAINEE' | 'TRAINER' | 'GYM' | null;

export function useCurrentUserRole() {
    const [role, setRole] = useState<Role>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const res = await fetch('/api/user/profile', {
                    cache: 'no-store',
                    credentials: 'include',
                });

                if (!res.ok) {
                    if (!cancelled) setRole(null);
                    return;
                }

                const data = await res.json();
                if (!cancelled) {
                    setRole((data?.role as Role) ?? null);
                }
            } catch {
                if (!cancelled) setRole(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return { role, loading };
}
