'use client';

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import HomePosts from "@/components/HomePosts";
import DesktopNavRail from "@/components/DesktopNavRail";

type HomePageShellProps = {
    posts: any;
};

export default function HomePageShell({ posts }: HomePageShellProps) {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col">
            <header className="w-full bg-white py-5 px-4 sm:px-6 relative flex items-center justify-center lg:justify-start lg:pl-12">
                <div className="flex-1 flex justify-center lg:justify-start">
                    <h1 className="font-serif font-bold text-3xl text-green-700 tracking-tight select-none text-center lg:text-left">
                        <Link href="/">
                            <span className="cursor-pointer">gymfluence</span>
                        </Link>
                    </h1>
                </div>
                <button
                    type="button"
                    className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full text-green-700 hover:bg-green-50 transition"
                    onClick={() => setMobileNavOpen((prev) => !prev)}
                    aria-label="Toggle menu"
                >
                    {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </header>

            <div className="flex-1 w-full flex">
                <div className="hidden lg:flex">
                    <DesktopNavRail />
                </div>

                <main className="flex-1 w-full flex justify-center px-4 sm:px-6">
                    <div className="w-full max-w-4xl">
                        <HomePosts initialPosts={posts} />
                    </div>
                </main>
            </div>

            <Navbar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        </div>
    );
}
