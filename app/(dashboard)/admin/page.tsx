import { getServerSession } from "next-auth";

import MobileHeader from "@/components/MobileHeader";
import AdminUserManager from "@/components/AdminUserManager";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";

function isAdminEmail(email: string | null | undefined) {
    if (!email) return false;
    const list = env.ADMIN_EMAILS.split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
    return list.includes(email.toLowerCase());
}

export default async function AdminPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center bg-[#f8f8f8] text-black dark:bg-[#050505] dark:text-white">
                <MobileHeader title="admin" href="/admin" />
                <h2 className="text-2xl mt-10 text-black/70 dark:text-white/80">Please log in to view the admin console.</h2>
            </main>
        );
    }

    if (!isAdminEmail(session.user.email)) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center bg-[#f8f8f8] text-black dark:bg-[#050505] dark:text-white">
                <MobileHeader title="admin" href="/admin" />
                <div className="mt-10 text-center space-y-2 px-4">
                    <h2 className="text-2xl font-semibold">Access restricted</h2>
                    <p className="text-zinc-600 dark:text-white/70 text-sm max-w-sm mx-auto">
                        This console is only available to admin accounts. Please contact support if you
                        believe this is an error.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#f8f8f8] text-black dark:bg-[#050505] dark:text-white">
            <MobileHeader title="admin console" href="/admin" />

            <header className="hidden lg:flex sticky top-0 z-30 w-full py-6 justify-start pl-[40px] bg-white text-black dark:bg-[#050505] dark:text-white border-b border-black/5 dark:border-white/10">
                <div>
                    <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-white/60">Admin console</p>
                    <h1 className="text-3xl font-bold">Manage users</h1>
                </div>
            </header>

            <section className="mx-auto max-w-6xl px-4 py-10 space-y-6">
                <p className="text-sm text-zinc-600 dark:text-white/60">
                    Search accounts and permanently delete users along with their posts, likes, comments,
                    follows, and messages.
                </p>

                <AdminUserManager />
            </section>
        </main>
    );
}
