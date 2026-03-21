'use client';

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const VALIDATION_INTERVAL_MS = 3000;

export default function DeletedUserSessionGuard() {
    const { status } = useSession();
    const pathname = usePathname();
    const signingOutRef = useRef(false);

    useEffect(() => {
        if (status !== "authenticated") return;

        let cancelled = false;

        const validateSession = async () => {
            if (cancelled || signingOutRef.current) return;

            try {
                const res = await fetch("/api/auth/validate-session", {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                });

                if (res.ok) return;

                if ((res.status === 401 || res.status === 404) && !signingOutRef.current) {
                    signingOutRef.current = true;
                    await signOut({ callbackUrl: "/" });
                }
            } catch {
                // Ignore transient network issues; validation will retry.
            }
        };

        validateSession();

        const intervalId = window.setInterval(validateSession, VALIDATION_INTERVAL_MS);
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                validateSession();
            }
        };
        const handleFocus = () => validateSession();
        const handleOnline = () => validateSession();

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);
        window.addEventListener("online", handleOnline);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("online", handleOnline);
        };
    }, [pathname, status]);

    return null;
}
