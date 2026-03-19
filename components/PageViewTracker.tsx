'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const VISITOR_ID_KEY = 'fittingin_visitor_id';

function getVisitorId() {
    if (typeof window === 'undefined') return null;

    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;

    const nextId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(VISITOR_ID_KEY, nextId);
    return nextId;
}

export default function PageViewTracker() {
    const pathname = usePathname();
    const lastPathRef = useRef<string | null>(null);

    useEffect(() => {
        if (!pathname || pathname === lastPathRef.current) return;
        lastPathRef.current = pathname;

        const body = JSON.stringify({ path: pathname, visitorId: getVisitorId() });

        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            const blob = new Blob([body], { type: 'application/json' });
            navigator.sendBeacon('/api/analytics/page-view', blob);
            return;
        }

        const controller = new AbortController();
        fetch('/api/analytics/page-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: controller.signal,
            keepalive: true,
        }).catch(() => {
            controller.abort();
        });

        return () => controller.abort();
    }, [pathname]);

    return null;
}
