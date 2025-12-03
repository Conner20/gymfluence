'use client';

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import Navbar from "@/components/Navbar";

type PageShellProps = {
    title: string;
    href?: string;
    children: React.ReactNode;
    subHeader?: React.ReactNode;
    mainClassName?: string;
};

export default function PageShell({
    title,
    href = "/",
    children,
    subHeader,
    mainClassName,
}: PageShellProps) {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col">
            <header className="w-full bg-white py-6 px-4 sm:px-6 relative flex items-center justify-center z-20">
                <h1 className="font-serif font-bold text-3xl text-green-700 tracking-tight select-none text-center">
                    <Link href={href}>
                        <span className="cursor-pointer">{title}</span>
                    </Link>
                </h1>
               <button
                    type="button"
                    className="lg:hidden absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full text-green-700 hover:bg-green-50 transition"
                    onClick={() => setMobileNavOpen((prev) => !prev)}
                    aria-label="Toggle menu"
                >
                    {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </header>

            {subHeader && <div className="w-full">{subHeader}</div>}

            <main className={clsx("flex-1 w-full", mainClassName)}>{children}</main>

            <Navbar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        </div>
    );
}
