'use client';

import { Bell, BriefcaseBusiness, Moon, Sun } from "lucide-react";
import Link from "next/link";
import MobileHeader from "@/components/MobileHeader";
import HomePosts from "@/components/HomePosts";
import { useTheme } from "@/components/ThemeProvider";
import NotificationsModal from "@/components/NotificationsModal";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useLiveRefresh } from "@/app/hooks/useLiveRefresh";

type HomePageShellProps = {
    posts: any;
    isAdmin?: boolean;
};

type NotificationListItem = {
    createdAt: string;
};

export default function HomePageShell({ posts, isAdmin = false }: HomePageShellProps) {
    const { theme, toggleTheme } = useTheme();
    const { data: session } = useSession();
    const darkMode = theme === "dark";
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [lastNotificationsSeenAt, setLastNotificationsSeenAt] = useState(0);
    const [feedRefreshToken, setFeedRefreshToken] = useState(0);
    const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const isSignedIn = Boolean(session?.user?.id);
    const touchStartYRef = useRef<number | null>(null);
    const pullActiveRef = useRef(false);
    const PULL_THRESHOLD = 72;

    const refreshHomeFeed = async () => {
        if (isRefreshingFeed) return;
        setIsRefreshingFeed(true);
        setFeedRefreshToken((prev) => prev + 1);
        window.setTimeout(() => {
            setIsRefreshingFeed(false);
            setPullDistance(0);
        }, 700);
    };

    const refreshNotificationCount = async () => {
        if (!isSignedIn) return;
        try {
            const res = await fetch("/api/user/notifications", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            const items: NotificationListItem[] = Array.isArray(data?.items) ? data.items : [];
            const seenAt = data?.seenAt ? new Date(data.seenAt).getTime() : 0;
            setLastNotificationsSeenAt(seenAt);
            const unread = items.filter((item) => new Date(item.createdAt).getTime() > seenAt).length;
            setNotificationCount(unread);
        } catch {
            // ignore transient notification fetch issues
        }
    };

    useEffect(() => {
        if (!isSignedIn) return;
        refreshNotificationCount();
    }, [isSignedIn]);

    useLiveRefresh(refreshNotificationCount, { enabled: isSignedIn, interval: 5000 });

    const openNotifications = async () => {
        setNotificationsOpen(true);
        if (isSignedIn) {
            try {
                const res = await fetch("/api/user/notifications", { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    const previousSeenAt = data?.seenAt ? new Date(data.seenAt).getTime() : 0;
                    setLastNotificationsSeenAt(previousSeenAt);
                }
            } catch {
                // ignore
            }
            try {
                await fetch("/api/user/notifications", { method: "POST" });
            } catch {
                // ignore
            }
        }
        setNotificationCount(0);
    };

    const ThemeToggle = ({ className = "" }: { className?: string }) => (
        <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-black hover:text-white dark:border-white/30 dark:text-white dark:hover:bg-white/10 ${className}`}
        >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );

    const AdminButton = ({ className = "" }: { className?: string }) =>
        isAdmin ? (
            <Link
                href="/admin"
                aria-label="Admin console"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-black hover:text-white dark:border-white/30 dark:text-white dark:hover:bg-white/10 ${className}`}
            >
                <BriefcaseBusiness size={18} />
            </Link>
        ) : null;

    const NotificationsButton = ({ className = "" }: { className?: string }) => (
        <button
            type="button"
            aria-label="Notifications"
            onClick={openNotifications}
            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-black hover:text-white dark:border-white/30 dark:text-white dark:hover:bg-white/10 ${className}`}
        >
            <Bell size={18} />
            {notificationCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {notificationCount > 9 ? "9+" : notificationCount}
                </span>
            )}
        </button>
    );

    const headerActions = (
        <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationsButton />
            <AdminButton />
        </div>
    );

    const mobileLeftActions = (
        <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <NotificationsButton />
        </div>
    );

    const mobileRightActions = (
        <div className="lg:hidden">
            <AdminButton />
        </div>
    );

    const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
        if (window.innerWidth >= 1024 || window.scrollY > 0 || isRefreshingFeed) return;
        touchStartYRef.current = event.touches[0]?.clientY ?? null;
        pullActiveRef.current = true;
    };

    const handleTouchMove = (event: React.TouchEvent<HTMLElement>) => {
        if (!pullActiveRef.current || touchStartYRef.current === null) return;
        const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
        const nextDistance = Math.max(0, currentY - touchStartYRef.current);
        if (window.scrollY <= 0 && nextDistance > 0) {
            setPullDistance(Math.min(nextDistance, 96));
        } else {
            pullActiveRef.current = false;
            touchStartYRef.current = null;
            setPullDistance(0);
        }
    };

    const handleTouchEnd = async () => {
        if (!pullActiveRef.current) {
            setPullDistance(0);
            return;
        }

        const shouldRefresh = pullDistance >= PULL_THRESHOLD;
        pullActiveRef.current = false;
        touchStartYRef.current = null;

        if (shouldRefresh) {
            await refreshHomeFeed();
            return;
        }

        setPullDistance(0);
    };

    return (
        <>
            <div className="relative flex min-h-screen flex-col bg-[#f8f8f8] text-black transition-colors dark:bg-[#050505] dark:text-white">
                <MobileHeader
                    title="fitting"
                    href="/"
                    leftAccessory={mobileLeftActions}
                    rightAccessory={mobileRightActions}
                />

                <header className="hidden w-full items-center justify-center bg-white px-6 py-5 lg:flex dark:bg-neutral-900">
                    <div className="absolute left-6 hidden items-center gap-2 lg:flex">
                        {headerActions}
                    </div>
                    <Link href="/" className="text-2xl font-semibold tracking-tight text-green-700 dark:text-green-400">
                        <span>fitt</span>
                        <span className="underline decoration-2 decoration-green-700 underline-offset-[2px] dark:decoration-green-400">in</span>
                        <span>g</span>
                    </Link>
                </header>

                <main
                    className="flex w-full flex-1 justify-center px-4 sm:px-6"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                >
                    <div className="w-full max-w-3xl">
                        <div className="lg:hidden">
                            <div
                                className="flex items-center justify-center overflow-hidden transition-all"
                                style={{ height: isRefreshingFeed ? 40 : Math.min(pullDistance * 0.55, 40) }}
                            >
                                {(isRefreshingFeed || pullDistance > 0) && (
                                    <span
                                        className={`h-5 w-5 rounded-full border-2 border-black border-t-transparent dark:border-white dark:border-t-transparent ${
                                            isRefreshingFeed || pullDistance >= PULL_THRESHOLD ? "animate-spin" : ""
                                        }`}
                                    />
                                )}
                            </div>
                        </div>
                        <HomePosts initialPosts={posts} refreshToken={feedRefreshToken} />
                    </div>
                </main>
            </div>
            <NotificationsModal
                open={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                onAnyChange={refreshNotificationCount}
                seenAt={lastNotificationsSeenAt}
            />
        </>
    );
}
