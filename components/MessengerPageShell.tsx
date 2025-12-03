'use client';

import Messenger from "@/components/Messenger";
import MobileHeader from "@/components/MobileHeader";

export default function MessengerPageShell() {
    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col">
            <MobileHeader title="messenger" href="/messages" />

            <header className="hidden lg:flex w-full bg-white py-6 px-6 items-center justify-center border-b">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                    messenger
                </h1>
            </header>

            <main className="flex-1 flex justify-center px-0 sm:px-4 py-6 w-full">
                <Messenger />
            </main>
        </div>
    );
}
