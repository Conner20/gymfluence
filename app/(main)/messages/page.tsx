import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Link from "next/link";
import Messenger from "@/components/Messenger";
import Navbar from "@/components/Navbar";
import { Menu, X } from "lucide-react";

export default async function Messages() {
    const session = await getServerSession(authOptions);
    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col">
            <header className="w-full bg-white py-6 px-4 sm:px-6 flex items-center justify-center relative z-20">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none text-center">
                    <Link href="/messages">
                        <span className="cursor-pointer">messenger</span>
                    </Link>
                </h1>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                        type="button"
                        className="lg:hidden p-2 rounded-full text-green-700 hover:bg-green-50 transition"
                        id="messenger-menu-trigger"
                        data-nav="mobile"
                    >
                        <Menu size={22} />
                    </button>
                </div>
            </header>
            <main className="flex-1 flex justify-center px-4 py-6 w-full">
                <Messenger />
            </main>
            <Navbar />
        </div>
    );
}
