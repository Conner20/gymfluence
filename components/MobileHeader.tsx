'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import clsx from "clsx";

type MobileHeaderProps = {
    title: string;
    href?: string;
    subContent?: React.ReactNode;
    leftAccessory?: React.ReactNode;
    rightAccessory?: React.ReactNode;
};

export default function MobileHeader({ title, href = "/", subContent, leftAccessory, rightAccessory }: MobileHeaderProps) {
    const [mobileNavOpen, setMobileNavOpen] = useState(true);

    useEffect(() => {
        if (typeof window === "undefined") return;
        let lastY = window.scrollY;
        const SHOW_THRESHOLD = 12;
        const HIDE_THRESHOLD = 8;

        const handleScroll = () => {
            const currentY = window.scrollY;
            const delta = currentY - lastY;

            if (currentY <= 24) {
                setMobileNavOpen(true);
            } else if (delta >= HIDE_THRESHOLD) {
                setMobileNavOpen(false);
            } else if (delta <= -SHOW_THRESHOLD) {
                setMobileNavOpen(true);
            }

            lastY = currentY;
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <>
            <header className="lg:hidden w-full bg-white py-5 px-4 sm:px-6 relative flex items-center justify-center z-20 dark:bg-neutral-900">
                <div
                    className="absolute inset-x-0 top-0 bg-white dark:bg-neutral-900 lg:hidden"
                    style={{ height: 'env(safe-area-inset-top, 0px)' }}
                />
                {leftAccessory && (
                    <div className="absolute left-4">
                        {leftAccessory}
                    </div>
                )}
                <h1 className="font-roboto text-3xl tracking-tight select-none text-center text-green-700 dark:text-green-400">
                    <Link href={href} className="cursor-pointer">
                        {title.toLowerCase() === "fitting" ? (
                            <span className="font-semibold">
                                fitt<span className="underline decoration-2 decoration-green-600 underline-offset-[2px] dark:decoration-green-400">in</span>g
                            </span>
                        ) : (
                            <span>{title}</span>
                        )}
                    </Link>
                </h1>
                <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {rightAccessory}
                </div>
            </header>

            {subContent && (
                <div className={clsx("lg:hidden w-full bg-white dark:bg-neutral-900")}>
                    {subContent}
                </div>
            )}

            <Navbar mobileOpen={mobileNavOpen} />
        </>
    );
}
