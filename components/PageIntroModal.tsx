'use client';

import { useCurrentUserRole } from '@/app/hooks/useCurrentUserRole';
import { BookText, Home, MessageCircle, Search, Settings, User } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Role = 'TRAINEE' | 'TRAINER' | 'GYM';
type PageKey = 'home' | 'search' | 'dashboard' | 'messages' | 'profile' | 'settings';

const PAGE_COPY: Record<Role, Record<PageKey, { title: string; description: string }>> = {
    TRAINEE: {
        home: {
            title: 'Home',
            description: 'Welcome to Fitting In! See posts and updates from your fitness community.',
        },
        search: {
            title: 'Search',
            description: 'Discover gyms, trainers, and friends that match your goals and preferences.',
        },
        dashboard: {
            title: 'Dashboard',
            description: 'Track workouts, wellness, and nutrition to monitor your progress.',
        },
        messages: {
            title: 'Messages',
            description: 'Message trainers, gyms, and friends to ask questions and plan workouts.',
        },
        profile: {
            title: 'Profile',
            description: 'Show your progress, interests, goals, and fitness journey.',
        },
        settings: {
            title: 'Settings',
            description: 'Manage your account, preferences, and profile details.',
        },
    },
    TRAINER: {
        home: {
            title: 'Home',
            description: 'Welcome to Fitting In! Grow your presence in the fitness community by posting progress, and tips.',
        },
        search: {
            title: 'Search',
            description: 'Find clients, gyms, and trainers to grow your network and discover new opportunities.',
        },
        dashboard: {
            title: 'Dashboard',
            description: 'Track fitness goals, share dashboard stats, and help keep clients accountable.',
        },
        messages: {
            title: 'Messages',
            description: 'Message clients, gyms, and other trainers to build your network.',
        },
        profile: {
            title: 'Profile',
            description: 'Showcase your services, progress, and experience.',
        },
        settings: {
            title: 'Settings',
            description: 'Manage your account, preferences, and trainer profile.',
        },
    },
    GYM: {
        home: {
            title: 'Home',
            description: 'Welcome to Fitting In! Promote your facility and connect with trainers and potential members.',
        },
        search: {
            title: 'Search',
            description: 'Find trainers and potential members who may be a good fit for your facility.',
        },
        dashboard: {
            title: 'Dashboard',
            description: '',
        },
        messages: {
            title: 'Messages',
            description: 'Message trainers and members to answer questions, discuss opportunities, and grow your network.',
        },
        profile: {
            title: 'Profile',
            description: 'Showcase your facility, amenities, pricing, and opportunities.',
        },
        settings: {
            title: 'Settings',
            description: 'Manage your account, preferences, and gym profile.',
        },
    },
};

function getPageKey(pathname: string | null): PageKey | null {
    if (!pathname) return null;
    if (pathname === '/home') return 'home';
    if (pathname === '/search') return 'search';
    if (pathname === '/messages') return 'messages';
    if (pathname === '/profile') return 'profile';
    if (pathname === '/settings') return 'settings';
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'dashboard';
    return null;
}

const PAGE_ICONS: Record<PageKey, typeof Home> = {
    home: Home,
    search: Search,
    dashboard: BookText,
    messages: MessageCircle,
    profile: User,
    settings: Settings,
};

function splitWelcomeDescription(description: string) {
    const welcomePrefix = 'Welcome to Fitting In!';
    if (!description.startsWith(welcomePrefix)) {
        return { welcome: null, body: description };
    }

    const body = description.slice(welcomePrefix.length).trim();
    return {
        welcome: welcomePrefix,
        body,
    };
}

export default function PageIntroModal() {
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const { role, loading: roleLoading } = useCurrentUserRole();
    const [open, setOpen] = useState(false);

    const pageKey = useMemo(() => getPageKey(pathname), [pathname]);
    const resolvedRole = role ?? null;
    const roleReady = !roleLoading && !!resolvedRole;
    const userKey = (session?.user as { id?: string; email?: string } | undefined)?.id
        ?? session?.user?.email
        ?? null;

    const copy = pageKey && resolvedRole ? PAGE_COPY[resolvedRole][pageKey] : null;
    const Icon = pageKey ? PAGE_ICONS[pageKey] : null;
    const splitCopy = copy ? splitWelcomeDescription(copy.description) : null;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (status === 'loading' || !roleReady || !pageKey || !userKey || !copy?.description) {
            setOpen(false);
            return;
        }

        const seenKey = `page-intro:${userKey}:${pageKey}`;
        const seen = window.localStorage.getItem(seenKey);
        setOpen(!seen);
    }, [copy?.description, pageKey, roleReady, status, userKey]);

    const handleClose = () => {
        if (typeof window !== 'undefined' && pageKey && userKey) {
            window.localStorage.setItem(`page-intro:${userKey}:${pageKey}`, '1');
        }
        setOpen(false);
    };

    if (!open || !copy) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-300 bg-zinc-100 p-6 dark:border-white/10 dark:bg-neutral-800">
                <div className="flex items-center gap-3">
                    {Icon && (
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-200 text-zinc-900 dark:bg-white/10 dark:text-white">
                            <Icon size={22} strokeWidth={2} />
                        </div>
                    )}
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{copy.title}</h2>
                </div>
                {splitCopy?.welcome ? (
                    <div className="mt-3">
                        <div className="pl-1 text-sm font-bold text-black dark:text-white dark:[text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
                            {splitCopy.welcome}
                        </div>
                        <p className="mt-3 pl-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{splitCopy.body}</p>
                    </div>
                ) : (
                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{copy.description}</p>
                )}
                <button
                    type="button"
                    onClick={handleClose}
                    className="mt-5 flex w-fit mx-auto items-center justify-center rounded-lg border border-green-600 bg-transparent px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-500/10"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}
