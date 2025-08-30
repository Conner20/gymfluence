'use client';

import { useEffect, useRef, useState } from 'react';

type Options<T> = {
    interval?: number;              // ms
    onData?: (data: T) => void;
    startImmediately?: boolean;     // default true
};

export function usePolling<T>(
    fetcher: () => Promise<T>,
    { interval = 3000, onData, startImmediately = true }: Options<T> = {}
) {
    const [initialLoading, setInitialLoading] = useState(startImmediately);
    const [refreshing, setRefreshing] = useState(false);
    const timer = useRef<number | null>(null);
    const disposed = useRef(false);

    async function tick(first = false) {
        try {
            if (first) setInitialLoading(true);
            else setRefreshing(true);
            const data = await fetcher();
            if (!disposed.current) onData?.(data);
        } finally {
            if (!disposed.current) {
                if (first) setInitialLoading(false);
                else setRefreshing(false);
            }
        }
    }

    useEffect(() => {
        disposed.current = false;
        tick(true); // first load (shows initial skeleton once)
        timer.current = window.setInterval(() => tick(false), interval);
        return () => {
            disposed.current = true;
            if (timer.current) window.clearInterval(timer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { initialLoading, refreshing };
}
