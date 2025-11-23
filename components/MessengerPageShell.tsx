'use client';

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Messenger from "@/components/Messenger";
import Navbar from "@/components/Navbar";

export default function MessengerPageShell() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col">
            <header className="w-full bg-white py-6 px-4 sm:px-6 flex items-center justify-center relative z-20">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none text-center">
                    <Link href="/messages">
                        <span className="cursor-pointer">messenger</span>
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
            <main className="flex-1 flex justify-center px-4 py-6 w-full">
                <Messenger />
            </main>
            <Navbar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        </div>
    );
}
