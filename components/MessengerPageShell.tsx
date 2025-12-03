'use client';

import Messenger from "@/components/Messenger";
import PageShell from "@/components/PageShell";

export default function MessengerPageShell() {
    return (
        <PageShell title="messenger" href="/messages" mainClassName="flex justify-center px-0 sm:px-4 py-6 w-full">
            <div className="hidden lg:flex w-full bg-white py-6 px-6 mb-4">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                    messenger
                </h1>
            </div>
            <Messenger />
        </PageShell>
    );
}
