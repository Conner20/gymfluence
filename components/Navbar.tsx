// components/Sidebar.tsx

'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Home, Search, PlusCircle, BookText, MessageCircle, User, Settings, X
} from "lucide-react";
import { useMemo, useState } from "react";
import CreatePost from "./CreatePost";

export const navItems = [
    {
        label: "Home",
        href: "/home",
        icon: (active: boolean) => (
            <Home size={32} strokeWidth={active ? 2.5 : 1.5} color={active ? "#111" : "#222"} />
        )
    },
    {
        label: "Search",
        href: "/search",
        icon: (active: boolean) => (
            <Search size={32} strokeWidth={active ? 2.5 : 1.5} color={active ? "#111" : "#222"} />
        )
    },
    {
        label: "Create Post",
        href: "#",
        icon: (active: boolean) => (
            <PlusCircle size={32} strokeWidth={active ? 2.5 : 1.5} color={active ? "#111" : "#222"} />
        ),
        type: "modal"
    },
    {
        label: "Dashboard",
        href: "/dashboard",
        icon: (active: boolean) => (
            <BookText size={32} strokeWidth={active ? 2.5 : 1.5} color={active ? "#111" : "#222"} />
        )
    },
    {
        label: "Messages",
        href: "/messages",
        icon: (active: boolean) => (
            <MessageCircle size={32} strokeWidth={active ? 2.5 : 1.5} color={active ? "#111" : "#222"} />
        )
    },
    {
        label: "Profile",
        href: "/profile",
        icon: (active: boolean) => (
            <User size={32} strokeWidth={active ? 2.5 : 1.5} color={active ? "#111" : "#222"} />
        )
    },
    {
        label: "Settings",
        href: "/settings",
        icon: (active: boolean) => (
            <Settings size={32} strokeWidth={active ? 2.5 : 1.5} color={active ? "#111" : "#222"} />
        )
    },
];

type NavbarProps = {
    mobileOpen?: boolean;
    onMobileClose?: () => void;
};

export default function Sidebar({ mobileOpen = false, onMobileClose }: NavbarProps) {
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
                            className="p-2 hover:bg-zinc-100 rounded-xl transition"
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
                        className={`p-2 rounded-xl flex items-center justify-center transition
                ${isActive ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
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
            <div
                className={`lg:hidden fixed bottom-0 inset-x-0 bg-white border-t z-50 transition-transform duration-200 ${
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
                                    className="p-2 rounded-full hover:bg-zinc-100 transition"
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
                                    isActive ? "bg-zinc-100" : "hover:bg-zinc-50"
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
                    <div className="bg-white p-6 rounded-xl shadow-lg w-[360px] max-w-[95vw] relative">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute right-4 top-4 p-1 hover:bg-zinc-100 rounded-full transition"
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
