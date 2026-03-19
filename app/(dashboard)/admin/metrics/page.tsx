import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import MobileHeader from "@/components/MobileHeader";
import AdminUserGrowthChart from "@/components/AdminUserGrowthChart";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { db } from "@/prisma/client";

type ChartPoint = {
    date: string;
    total: number;
    active: number;
    label: string;
};

type SimplePageView = {
    path: string;
    createdAt: Date;
    userId: string | null;
    visitorId: string | null;
};

const CHART_WINDOW_DAYS = 30;
const ACTIVE_WINDOW_DAYS = 7;

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
    return new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 1,
    }).format(value);
}

function formatDateLabel(date: Date) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function startOfDay(date: Date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
}

function isPublicOrAuthPath(path: string) {
    return (
        path === "/" ||
        path.startsWith("/log-in") ||
        path.startsWith("/sign-up") ||
        path.startsWith("/verify-email") ||
        path.startsWith("/forgot-password") ||
        path.startsWith("/reset-password") ||
        path.startsWith("/user-onboarding") ||
        path.startsWith("/legal") ||
        path.startsWith("/terms") ||
        path.startsWith("/privacy") ||
        path.startsWith("/support")
    );
}

function isUserActivityPath(path: string) {
    return !isPublicOrAuthPath(path) && !path.startsWith("/api");
}

function getVisitorKey(view: SimplePageView) {
    return view.visitorId ?? view.userId ?? `pageview:${view.path}:${view.createdAt.toISOString()}`;
}

function getDistinctCount(values: Array<string | null | undefined>) {
    return new Set(values.filter((value): value is string => Boolean(value))).size;
}

export default async function AdminMetricsPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdminEmail(session.user.email)) {
        redirect("/");
    }

    const now = new Date();
    const chartStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (CHART_WINDOW_DAYS - 1)));
    const chartSeedStart = startOfDay(new Date(chartStart));
    chartSeedStart.setDate(chartSeedStart.getDate() - (ACTIVE_WINDOW_DAYS - 1));
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - ACTIVE_WINDOW_DAYS);

    const [users, pageViews] = await Promise.all([
        db.user.findMany({
            select: { id: true, createdAt: true, email: true },
            orderBy: { createdAt: "asc" },
        }),
        db.pageView.findMany({
            where: {
                createdAt: {
                    gte: chartSeedStart,
                },
            },
            select: {
                path: true,
                createdAt: true,
                userId: true,
                visitorId: true,
            },
            orderBy: { createdAt: "asc" },
        }),
    ]);

    const adminUserIds = new Set(
        users
            .filter((user) => isAdminEmail(user.email))
            .map((user) => user.id),
    );
    const nonAdminUsers = users.filter((user) => !adminUserIds.has(user.id));
    const nonAdminPageViews = pageViews.filter((view) => !view.userId || !adminUserIds.has(view.userId));

    const viewsInWindow = nonAdminPageViews.filter((view) => view.createdAt >= chartStart);
    const userActivityViews = viewsInWindow.filter(
        (view) => Boolean(view.userId) && isUserActivityPath(view.path),
    );
    const recentActiveViews = nonAdminPageViews.filter(
        (view) => Boolean(view.userId) && isUserActivityPath(view.path) && view.createdAt >= weekAgo,
    );
    const landingViews = viewsInWindow.filter((view) => view.path === "/");

    const totalUsers = users.length;
    const newUsersInWindow = nonAdminUsers.filter((user) => user.createdAt >= chartStart).length;
    const activeUsers = getDistinctCount(recentActiveViews.map((view) => view.userId));
    const uniqueLandingVisitors = new Set(landingViews.map((view) => getVisitorKey(view))).size;
    const conversionBase = Math.max(uniqueLandingVisitors, newUsersInWindow);
    const conversionRate = conversionBase > 0 ? newUsersInWindow / conversionBase : 0;

    const topPagesMap = new Map<string, number>();
    for (const view of userActivityViews) {
        topPagesMap.set(view.path, (topPagesMap.get(view.path) ?? 0) + 1);
    }
    const pageViewsWindow = userActivityViews.length;
    const topPages = [...topPagesMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([path, count]) => ({
            path,
            count,
            percentage: pageViewsWindow ? count / pageViewsWindow : 0,
        }));

    const series: ChartPoint[] = [];
    let userPointer = 0;
    let cumulativeUsers = 0;

    for (let i = 0; i < CHART_WINDOW_DAYS; i++) {
        const dayStart = startOfDay(new Date(chartStart));
        dayStart.setDate(dayStart.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        while (userPointer < users.length && users[userPointer].createdAt < dayEnd) {
            cumulativeUsers += 1;
            userPointer += 1;
        }

        const activeWindowStart = new Date(dayStart);
        activeWindowStart.setDate(activeWindowStart.getDate() - (ACTIVE_WINDOW_DAYS - 1));

        const activeOnDay = getDistinctCount(
            nonAdminPageViews
                .filter(
                    (view) =>
                        Boolean(view.userId) &&
                        isUserActivityPath(view.path) &&
                        view.createdAt >= activeWindowStart &&
                        view.createdAt < dayEnd,
                )
                .map((view) => view.userId),
        );

        series.push({
            date: dayStart.toISOString(),
            total: cumulativeUsers,
            active: activeOnDay,
            label: formatDateLabel(dayStart),
        });
    }

    const activeRatio = totalUsers ? activeUsers / totalUsers : 0;
    const averageActiveVisitsPerDay = CHART_WINDOW_DAYS ? Math.round(pageViewsWindow / CHART_WINDOW_DAYS) : 0;

    return (
        <main className="min-h-screen bg-[#f8f8f8] text-black dark:bg-[#050505] dark:text-white">
            <MobileHeader title="admin metrics" href="/admin/metrics" />

            <header className="sticky top-0 z-30 hidden w-full flex-col gap-4 border-b border-black/5 bg-white py-6 pl-[40px] text-black dark:border-white/10 dark:bg-[#050505] dark:text-white lg:flex">
                <div>
                    <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-white/60">Admin console</p>
                    <h1 className="text-3xl font-bold">User metrics</h1>
                </div>
                <nav className="flex gap-4 text-sm text-zinc-600 dark:text-white/60">
                    <Link
                        href="/admin"
                        className="rounded-full border border-transparent px-4 py-1 hover:border-black/10 dark:hover:border-white/20"
                    >
                        Users
                    </Link>
                    <Link
                        href="/admin/metrics"
                        className="rounded-full border border-black/10 px-4 py-1 text-black dark:border-white/20 dark:text-white"
                    >
                        Metrics
                    </Link>
                </nav>
            </header>

            <section className="mx-auto max-w-6xl space-y-8 px-4 py-10">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <p className="text-sm text-zinc-500 dark:text-white/60">Total users</p>
                        <p className="mt-2 text-3xl font-semibold">{formatNumber(totalUsers)}</p>
                        <p className="text-xs text-zinc-500 dark:text-white/60">Lifetime accounts created</p>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <p className="text-sm text-zinc-500 dark:text-white/60">Active users (7d)</p>
                        <p className="mt-2 text-3xl font-semibold">{formatNumber(activeUsers)}</p>
                        <p className="text-xs text-zinc-500 dark:text-white/60">
                            Distinct signed-in users visiting app pages
                        </p>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <p className="text-sm text-zinc-500 dark:text-white/60">Landing visitors (30d)</p>
                        <p className="mt-2 text-3xl font-semibold">{formatNumber(uniqueLandingVisitors)}</p>
                        <p className="text-xs text-zinc-500 dark:text-white/60">Unique people visiting `/`</p>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <p className="text-sm text-zinc-500 dark:text-white/60">Conversion rate (30d)</p>
                        <p className="mt-2 text-3xl font-semibold">{formatPercent(conversionRate)}</p>
                        <p className="text-xs text-zinc-500 dark:text-white/60">New users / unique landing visitors</p>
                    </div>
                </div>

                <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-white/60">Growth</p>
                            <h2 className="text-2xl font-semibold">Users vs active users</h2>
                            <p className="text-sm text-zinc-500 dark:text-white/60">
                                Total users is cumulative. Active users = distinct app visitors in the trailing 7 days.
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-white/70">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                Total users
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-sky-500" />
                                Active users
                            </div>
                        </div>
                    </div>
                    <AdminUserGrowthChart data={series} />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-white/60">User trends</p>
                                <h3 className="text-lg font-semibold">Top app pages · last 30 days</h3>
                            </div>
                        </div>
                        <div className="mt-4 space-y-3">
                            {topPages.length === 0 && (
                                <p className="text-sm text-zinc-500 dark:text-white/60">No signed-in page activity yet.</p>
                            )}
                            {topPages.map((page) => (
                                <div
                                    key={page.path}
                                    className="flex items-center justify-between rounded-2xl border border-black/5 bg-zinc-50 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium text-black dark:text-white">{page.path}</span>
                                        <span className="text-xs text-zinc-500 dark:text-white/60">
                                            {formatPercent(page.percentage)}
                                        </span>
                                    </div>
                                    <span className="text-lg font-semibold text-black dark:text-white">
                                        {formatNumber(page.count)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-white/60">Snapshot</p>
                        <h3 className="text-lg font-semibold">Engagement quick stats</h3>
                        <div className="mt-5 space-y-4 text-sm text-zinc-600 dark:text-white/70">
                            <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                <span>Active ratio (7d)</span>
                                <span className="font-semibold text-black dark:text-white">
                                    {formatPercent(activeRatio)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                <span>New users (30d)</span>
                                <span className="font-semibold text-black dark:text-white">
                                    {formatNumber(newUsersInWindow)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                <span>Average app visits / day</span>
                                <span className="font-semibold text-black dark:text-white">
                                    {formatNumber(averageActiveVisitsPerDay)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                <span>Most visited app page</span>
                                <span className="font-semibold text-black dark:text-white">
                                    {topPages[0]?.path ?? "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
