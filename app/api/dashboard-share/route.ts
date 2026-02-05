import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

async function getViewerId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        throw new Error("Unauthorized");
    }
    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!me) throw new Error("Unauthorized");
    return me.id;
}

const DASHBOARD_KEYS = ["workouts", "wellness", "nutrition"] as const;
type DashboardKey = (typeof DASHBOARD_KEYS)[number];

export async function GET(req: Request) {
    try {
        const userId = await getViewerId();
        const url = new URL(req.url);
        const includeFollowers = url.searchParams.get("followers") === "1";
        const outgoing = await db.dashboardShare.findMany({
            where: { ownerId: userId },
            include: {
                viewer: {
                    select: { id: true, username: true, name: true, image: true },
                },
            },
        });
        const incoming = await db.dashboardShare.findMany({
            where: {
                viewerId: userId,
                OR: [
                    { workouts: true },
                    { wellness: true },
                    { nutrition: true },
                ],
            },
            include: {
                owner: {
                    select: { id: true, username: true, name: true, image: true },
                },
            },
        });
        let followers: { id: string; username: string | null; name: string | null; image: string | null }[] = [];
        if (includeFollowers) {
            const rows = await db.follow.findMany({
                where: { followingId: userId, status: "ACCEPTED" },
                include: {
                    follower: {
                        select: { id: true, username: true, name: true, image: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            });
            followers = rows.map((r) => r.follower);
        }

        return NextResponse.json({
            outgoing: outgoing.map((share) => ({
                id: share.id,
                viewer: share.viewer,
                workouts: share.workouts,
                wellness: share.wellness,
                nutrition: share.nutrition,
            })),
            incoming: incoming.map((share) => ({
                id: share.id,
                owner: share.owner,
                workouts: share.workouts,
                wellness: share.wellness,
                nutrition: share.nutrition,
            })),
            followers,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unauthorized";
        return NextResponse.json({ message }, { status: message === "Unauthorized" ? 401 : 500 });
    }
}

export async function POST(req: Request) {
    try {
        const userId = await getViewerId();
        const body = await req.json().catch(() => null);
        const viewerId = typeof body?.viewerId === "string" ? body.viewerId : null;
        const dashboard: DashboardKey | null = DASHBOARD_KEYS.includes(body?.dashboard) ? body.dashboard : null;
        const enabled = Boolean(body?.enabled);

        if (!viewerId || !dashboard) {
            return NextResponse.json({ message: "Missing viewerId or dashboard" }, { status: 400 });
        }
        if (viewerId === userId) {
            return NextResponse.json({ message: "Cannot share with yourself" }, { status: 400 });
        }

        if (enabled) {
            const follower = await db.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: viewerId,
                        followingId: userId,
                    },
                },
                select: { status: true },
            });
            if (follower?.status !== "ACCEPTED") {
                return NextResponse.json({ message: "User must be a follower" }, { status: 403 });
            }
        }

        const share = await db.dashboardShare.upsert({
            where: {
                ownerId_viewerId: { ownerId: userId, viewerId },
            },
            update: {
                [dashboard]: enabled,
            },
            create: {
                ownerId: userId,
                viewerId,
                workouts: dashboard === "workouts" && enabled,
                wellness: dashboard === "wellness" && enabled,
                nutrition: dashboard === "nutrition" && enabled,
            },
        });

        if (!share.workouts && !share.wellness && !share.nutrition) {
            await db.dashboardShare.delete({
                where: { ownerId_viewerId: { ownerId: userId, viewerId } },
            });
            return NextResponse.json({ share: null });
        }

        return NextResponse.json({
            share: {
                viewerId,
                workouts: share.workouts,
                wellness: share.wellness,
                nutrition: share.nutrition,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unauthorized";
        return NextResponse.json({ message }, { status: message === "Unauthorized" ? 401 : 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const userId = await getViewerId();
        const body = await req.json().catch(() => null);
        const viewerId = typeof body?.viewerId === "string" ? body.viewerId : null;
        const ownerId = typeof body?.ownerId === "string" ? body.ownerId : null;

        if (viewerId) {
            await db.dashboardShare.deleteMany({
                where: { ownerId: userId, viewerId },
            });
            return NextResponse.json({ ok: true });
        }

        if (ownerId) {
            await db.dashboardShare.deleteMany({
                where: { ownerId, viewerId: userId },
            });
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ message: "Missing viewerId or ownerId" }, { status: 400 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unauthorized";
        return NextResponse.json({ message }, { status: message === "Unauthorized" ? 401 : 500 });
    }
}
