import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
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

    if (!session?.user || !isAdminEmail(session.user.email)) {
        redirect("/");
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
