'use client';

import { useEffect, useState } from "react";
import Messenger from "@/components/Messenger";
import MobileHeader from "@/components/MobileHeader";

export default function MessengerPageShell() {
    const [mobileViewportHeight, setMobileViewportHeight] = useState<number | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.innerWidth >= 1024) return;

        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const updateHeight = () => {
            if (window.innerWidth >= 1024) {
                setMobileViewportHeight(null);
                return;
            }

            const nextHeight = window.visualViewport?.height ?? window.innerHeight;
            setMobileViewportHeight(nextHeight);
            window.scrollTo(0, 0);
        };

        updateHeight();

        const syncHeightNow = () => {
            updateHeight();
            window.requestAnimationFrame(updateHeight);
        };

        window.addEventListener("resize", updateHeight);
        window.addEventListener("orientationchange", updateHeight);
        window.addEventListener("focusin", syncHeightNow);
        window.addEventListener("focusout", syncHeightNow);
        window.visualViewport?.addEventListener("resize", updateHeight);
        window.visualViewport?.addEventListener("scroll", updateHeight);

        return () => {
            window.removeEventListener("resize", updateHeight);
            window.removeEventListener("orientationchange", updateHeight);
            window.removeEventListener("focusin", syncHeightNow);
            window.removeEventListener("focusout", syncHeightNow);
            window.visualViewport?.removeEventListener("resize", updateHeight);
            window.visualViewport?.removeEventListener("scroll", updateHeight);
        };
    }, []);

    return (
        <div
            className="flex flex-col overflow-hidden bg-[#f8f8f8] dark:bg-[#050505] dark:text-gray-100 lg:min-h-screen lg:h-auto"
            style={mobileViewportHeight ? { height: `${mobileViewportHeight}px` } : undefined}
        >
            <MobileHeader title="messenger" href="/messages" />

            <header className="hidden lg:flex w-full bg-white py-6 justify-start pl-[40px] dark:bg-neutral-900 ">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none dark:text-green-400">
                    messenger
                </h1>
            </header>

            <main className="flex min-h-0 flex-1 w-full items-stretch justify-center overflow-hidden px-0 pb-0 pt-4 sm:px-4 sm:py-6 lg:pb-6">
                <Messenger />
            </main>
        </div>
    );
}
