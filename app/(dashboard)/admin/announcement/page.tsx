import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

import MobileHeader from "@/components/MobileHeader";
import AdminAnnouncementManager from "@/components/AdminAnnouncementManager";
import { authOptions } from "@/lib/auth";
import { hasAdminAccessByEmail } from "@/lib/admin";

export default async function AdminAnnouncementPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user || !(await hasAdminAccessByEmail(session.user.email))) {
        redirect("/");
    }

    return (
        <main className="min-h-screen bg-[#f8f8f8] text-black dark:bg-[#050505] dark:text-white">
            <MobileHeader title="admin announcement" href="/admin/announcement" />

            <header className="hidden lg:flex sticky top-0 z-30 w-full flex-col gap-4 py-6 pl-[40px] bg-white text-black dark:bg-[#050505] dark:text-white border-b border-black/5 dark:border-white/10">
                <div>
                    <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-white/60">Admin console</p>
                    <h1 className="text-3xl font-bold">Announcement</h1>
                </div>
                <nav className="flex gap-4 text-sm text-zinc-600 dark:text-white/60">
                    <Link href="/admin" className="rounded-full border border-transparent px-4 py-1 hover:border-black/10 dark:hover:border-white/20">
                        Users
                    </Link>
                    <Link href="/admin/metrics" className="rounded-full border border-transparent px-4 py-1 hover:border-black/10 dark:hover:border-white/20">
                        Metrics
                    </Link>
                    <Link href="/admin/announcement" className="rounded-full border border-black/10 px-4 py-1 text-black dark:border-white/20 dark:text-white">
                        Announcement
                    </Link>
                </nav>
            </header>

            <section className="mx-auto max-w-6xl px-4 py-10 space-y-6">
                <nav className="flex gap-2 lg:hidden">
                    <Link
                        href="/admin"
                        className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-600 dark:border-white/20 dark:text-white/70"
                    >
                        Users
                    </Link>
                    <Link
                        href="/admin/metrics"
                        className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-600 dark:border-white/20 dark:text-white/70"
                    >
                        Metrics
                    </Link>
                    <Link
                        href="/admin/announcement"
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black dark:border-white/20 dark:bg-white/10 dark:text-white"
                    >
                        Announcement
                    </Link>
                </nav>

                <AdminAnnouncementManager />
            </section>
        </main>
    );
}
