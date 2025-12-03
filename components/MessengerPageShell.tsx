'use client';

import Messenger from "@/components/Messenger";
import PageShell from "@/components/PageShell";

export default function MessengerPageShell() {
    return (
        <PageShell title="messenger" href="/messages" mainClassName="flex justify-center px-0 sm:px-4 py-6 w-full">
            <Messenger />
        </PageShell>
    );
}
