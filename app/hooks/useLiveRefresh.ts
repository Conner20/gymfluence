"use client";

import { useEffect, useRef } from "react";

export function useLiveRefresh(
    callback: () => void | Promise<void>,
    { enabled = true, interval = 5000 }: { enabled?: boolean; interval?: number } = {},
) {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;

        const run = () => {
            if (document.visibilityState !== "visible") return;
            void callbackRef.current();
        };

        const intervalId = window.setInterval(run, interval);
        const handleFocus = () => run();
        const handleVisibility = () => run();

        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [enabled, interval]);
}
