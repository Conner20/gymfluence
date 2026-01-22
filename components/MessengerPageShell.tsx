'use client';

import Messenger from "@/components/Messenger";
import MobileHeader from "@/components/MobileHeader";

export default function MessengerPageShell() {
    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col dark:bg-[#050505] dark:text-gray-100">
            <MobileHeader title="messenger" href="/messages" />

            <header className="hidden lg:flex w-full bg-white py-6 justify-start pl-[40px] dark:bg-neutral-900 ">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none dark:text-green-400">
                    messenger
                </h1>
            </header>

            <main className="flex-1 flex justify-center px-0 sm:px-4 py-6 w-full min-h-0 overflow-hidden items-stretch">
                <Messenger />
            </main>
        </div>
    );
}
