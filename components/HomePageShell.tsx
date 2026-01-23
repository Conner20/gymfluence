'use client';

import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import MobileHeader from "@/components/MobileHeader";
import HomePosts from "@/components/HomePosts";
import { useTheme } from "@/components/ThemeProvider";

type HomePageShellProps = {
    posts: any;
};

export default function HomePageShell({ posts }: HomePageShellProps) {
    const { theme, toggleTheme } = useTheme();
    const darkMode = theme === "dark";

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

    return (
            <div className="relative flex min-h-screen flex-col bg-[#f8f8f8] text-black transition-colors dark:bg-[#050505] dark:text-white">
                <MobileHeader title="gymfluence" href="/" leftAccessory={<ThemeToggle className="lg:hidden" />} />

                <header className="hidden w-full items-center justify-center bg-white px-6 py-5 lg:flex dark:bg-neutral-900">
                    <ThemeToggle className="absolute left-6 hidden lg:inline-flex" />
                    <Link href="/" className="font-roboto select-none text-3xl tracking-tight text-green-700 dark:text-green-400">
                        gymfluence
                    </Link>
                </header>

                <main className="flex w-full flex-1 justify-center px-4 sm:px-6">
                    <div className="w-full max-w-3xl">
                        <HomePosts initialPosts={posts} />
                    </div>
                </main>
            </div>
    );
}
