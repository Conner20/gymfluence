// components/Sidebar.tsx

'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Home, Search, PlusCircle, BookText, MessageCircle, User, Settings, X
} from "lucide-react";
import { useMemo, useState } from "react";
import CreatePost from "./CreatePost";

const navItems = [
    {
        label: "Home",
        href: "/home",
        icon: (active: boolean) => (
            <Home
                size={32}
                strokeWidth={active ? 2.5 : 1.5}
                className={active ? "text-black dark:text-white" : "text-zinc-800 dark:text-zinc-200"}
            />
        )
    },
    {
        label: "Search",
        href: "/search",
        icon: (active: boolean) => (
            <Search
                size={32}
                strokeWidth={active ? 2.5 : 1.5}
                className={active ? "text-black dark:text-white" : "text-zinc-800 dark:text-zinc-200"}
            />
        )
    },
    {
        label: "Create Post",
        href: "#",
        icon: (active: boolean) => (
            <PlusCircle
                size={32}
                strokeWidth={active ? 2.5 : 1.5}
                className={active ? "text-black dark:text-white" : "text-zinc-800 dark:text-zinc-200"}
            />
        ),
        type: "modal"
    },
    {
        label: "Dashboard",
        href: "/dashboard",
        icon: (active: boolean) => (
            <BookText
                size={32}
                strokeWidth={active ? 2.5 : 1.5}
                className={active ? "text-black dark:text-white" : "text-zinc-800 dark:text-zinc-200"}
            />
        )
    },
    {
        label: "Messages",
        href: "/messages",
        icon: (active: boolean) => (
            <MessageCircle
                size={32}
                strokeWidth={active ? 2.5 : 1.5}
                className={active ? "text-black dark:text-white" : "text-zinc-800 dark:text-zinc-200"}
            />
        )
    },
    {
        label: "Profile",
        href: "/profile",
        icon: (active: boolean) => (
            <User
                size={32}
                strokeWidth={active ? 2.5 : 1.5}
                className={active ? "text-black dark:text-white" : "text-zinc-800 dark:text-zinc-200"}
            />
        )
    },
    {
        label: "Settings",
        href: "/settings",
        icon: (active: boolean) => (
            <Settings
                size={32}
                strokeWidth={active ? 2.5 : 1.5}
                className={active ? "text-black dark:text-white" : "text-zinc-800 dark:text-zinc-200"}
            />
        )
    },
];

type NavbarProps = {
    mobileOpen?: boolean;
    onMobileClose?: () => void;
};

export default function Sidebar({ mobileOpen = true, onMobileClose }: NavbarProps) {
    const pathname = usePathname();
    const [showModal, setShowModal] = useState(false);

    const navContent = useMemo(
        () =>
            navItems.map((item, idx) => {
                const isActive = pathname === item.href;
                if (item.type === "modal") {
                    return (
                        <button
                            key={idx}
                            className="p-2 hover:bg-zinc-100 rounded-xl transition dark:hover:bg-white/5"
                            title={item.label}
                            onClick={() => setShowModal(true)}
                        >
                            {item.icon(false)}
                        </button>
                    );
                }
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`p-2 rounded-xl flex items-center justify-center transition ${
                            isActive
                                ? "bg-zinc-100 dark:bg-white/10"
                                : "hover:bg-zinc-50 dark:hover:bg-white/5"
                        }`}
                        title={item.label}
                        onClick={() => onMobileClose?.()}
                    >
                        {item.icon(isActive)}
                    </Link>
                );
            }),
        [onMobileClose, pathname]
    );

    return (
        <>
            <nav className="fixed top-0 right-0 z-50 hidden h-screen w-20 flex-col items-center bg-white lg:flex dark:bg-neutral-900 dark:border-l dark:border-white/10">
                <div className="flex flex-col justify-center items-center gap-8 h-full w-full">
                    {navContent}
                </div>
            </nav>

            <div
                className={`lg:hidden fixed bottom-0 inset-x-0 bg-white border-t z-50 transition-transform duration-200 dark:bg-neutral-900 dark:border-white/10 ${
                    mobileOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
                }`}
            >
                <div className="flex justify-around items-center py-2">
                    {navItems.map((item, idx) => {
                        const isActive = pathname === item.href;
                        if (item.type === "modal") {
                            return (
                                <button
                                    key={idx}
                                    className="p-2 rounded-full hover:bg-zinc-100 transition dark:hover:bg-white/5"
                                    onClick={() => setShowModal(true)}
                                    title={item.label}
                                    aria-label={item.label}
                                >
                                    {item.icon(false)}
                                </button>
                            );
                        }
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                        className={`p-2 rounded-full transition ${
                            isActive ? "bg-zinc-100 dark:bg-white/10" : "hover:bg-zinc-50 dark:hover:bg-white/5"
                        }`}
                                onClick={() => onMobileClose?.()}
                                title={item.label}
                                aria-label={item.label}
                            >
                                {item.icon(isActive)}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Modal with CreatePost */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-[99] flex items-center justify-center">
                    <div className="bg-white p-6 rounded-xl shadow-lg w-[360px] max-w-[95vw] relative dark:bg-neutral-900 dark:border dark:border-white/10 dark:text-gray-100">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute right-4 top-4 p-1 hover:bg-zinc-100 rounded-full transition dark:hover:bg-white/5"
                            aria-label="Close"
                            type="button"
                        >
                            <X size={24} />
                        </button>
                        <CreatePost onClose={() => setShowModal(false)} />
                    </div>
                </div>
            )}
        </>
    );
}
