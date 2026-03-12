'use client';

import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function LandingHeader() {
    const { theme, toggleTheme } = useTheme();
    const darkMode = theme === 'dark';

    return (
        <header className="sticky top-0 z-50 border-b bg-white text-black dark:border-black/40 dark:bg-black dark:text-white lg:bg-white/80 lg:backdrop-blur lg:dark:border-white/10 lg:dark:bg-black/40">
            <div
                className="lg:hidden border-b bg-white text-black dark:border-black/40 dark:bg-black dark:text-white"
                style={{ height: 'env(safe-area-inset-top, 0px)' }}
            />
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
                <Link href="/" className="text-2xl font-semibold tracking-tight text-green-700 dark:text-green-400">
                    <span>fitt</span>
                    <span className="underline decoration-2 decoration-green-700 underline-offset-[2px] dark:decoration-green-400">
                        in
                    </span>
                    <span>g</span>
                </Link>

                <nav className="flex items-center gap-2">
                    <Link
                        href="/log-in"
                        className="rounded-full border px-4 py-2 transition hover:bg-black hover:text-white dark:border-white/25 dark:text-white dark:hover:bg-white/10"
                    >
                        log in
                    </Link>
                    <Link
                        href="/sign-up"
                        className="rounded-full bg-green-700 px-4 py-2 text-white transition hover:bg-black dark:bg-green-600 dark:hover:bg-white/10"
                    >
                        sign up
                    </Link>
                    <button
                        type="button"
                        aria-label="Toggle theme"
                        onClick={toggleTheme}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-black hover:text-white dark:border-white/30 dark:text-white dark:hover:bg-white/10"
                    >
                        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </nav>
            </div>
        </header>
    );
}
