'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import clsx from "clsx";

type MobileHeaderProps = {
    title: string;
    href?: string;
    subContent?: React.ReactNode;
    leftAccessory?: React.ReactNode;
};

export default function MobileHeader({ title, href = "/", subContent, leftAccessory }: MobileHeaderProps) {
    const [mobileNavOpen, setMobileNavOpen] = useState(true);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = window.localStorage.getItem("mobileNavOpen");
        if (stored === null) return;
        setMobileNavOpen(stored === "true");
    }, []);

    const persistState = (next: boolean) => {
        setMobileNavOpen(next);
        if (typeof window !== "undefined") {
            window.localStorage.setItem("mobileNavOpen", next ? "true" : "false");
        }
    };

    return (
        <>
            <header className="lg:hidden w-full bg-white py-5 px-4 sm:px-6 relative flex items-center justify-center z-20 dark:bg-neutral-900">
                {leftAccessory && (
                    <div className="absolute left-4">
                        {leftAccessory}
                    </div>
                )}
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none text-center dark:text-green-400">
                    <Link href={href}>
                        <span className="cursor-pointer">{title}</span>
                    </Link>
                </h1>
                <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full text-green-700 hover:bg-green-50 transition dark:text-white dark:hover:bg-white/10"
                    onClick={() => persistState(!mobileNavOpen)}
                    aria-label="Toggle menu"
                >
                    {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </header>

            {subContent && (
                <div className={clsx("lg:hidden w-full bg-white dark:bg-neutral-900")}>
                    {subContent}
                </div>
            )}

            <Navbar mobileOpen={mobileNavOpen} onMobileClose={() => persistState(false)} />
        </>
    );
}
