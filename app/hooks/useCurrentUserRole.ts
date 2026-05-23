'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

type Role = 'TRAINEE' | 'TRAINER' | 'GYM' | null;

export function useCurrentUserRole() {
    const { data: session, status } = useSession();
    const [role, setRole] = useState<Role>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const sessionRole = (session?.user as { role?: Role } | undefined)?.role ?? null;
        if (sessionRole) {
            setRole(sessionRole);
            setLoading(false);
            return;
        }

        if (status === 'loading') {
            return;
        }

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
    }, [session, status]);

    return { role, loading };
}
