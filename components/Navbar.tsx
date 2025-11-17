// components/Sidebar.tsx

'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Home, Search, PlusCircle, BookText, MessageCircle, User, Settings, X
} from "lucide-react";
import { useState } from "react";
import CreatePost from "./CreatePost";

const navItems = [
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

export default function Sidebar() {
    const pathname = usePathname();
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <nav className="fixed top-0 right-0 h-screen w-20 bg-white flex flex-col items-center z-50">
                <div className="flex flex-col justify-center items-center gap-8 h-full w-full">
                    {navItems.map((item, idx) => {
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
                            >
                                {item.icon(isActive)}
                            </Link>
                        );
                    })}
                </div>
            </nav>

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
                        <CreatePost
                            onClose={() => setShowModal(false)}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
