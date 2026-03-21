import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import {
    getUserAdminStatus,
    hasAdminAccessByEmail,
    hasSuperAdminAccessByEmail,
    isConfiguredAdminEmail,
    isMissingIsAdminColumnError,
} from "@/lib/admin";
import { db } from "@/prisma/client";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasAdminAccessByEmail(session.user.email))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const take = Math.min(Math.max(Number(searchParams.get("limit") || 25), 1), 100);

    const where = query
        ? {
            OR: [
                { username: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
            ],
        }
        : {};

    let users: Array<{
        id: string;
        username: string | null;
        name: string | null;
        email: string | null;
        role: string | null;
        isAdmin: boolean;
        isPrivate: boolean;
        _count: {
            post: number;
            likes: number;
            comments: number;
            followers: number;
            following: number;
        };
    }> = [];

    try {
        users = await db.user.findMany({
            where,
            take: 500,
            orderBy: [{ username: "asc" }],
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                role: true,
                isAdmin: true,
                isPrivate: true,
                _count: {
                    select: {
                        post: true,
                        likes: true,
                        comments: true,
                        followers: true,
                        following: true,
                    },
                },
            },
        });
    } catch (error) {
        if (!isMissingIsAdminColumnError(error)) {
            throw error;
        }

        const legacyUsers = await db.user.findMany({
            where,
            take: 500,
            orderBy: [{ username: "asc" }],
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                role: true,
                isPrivate: true,
                _count: {
                    select: {
                        post: true,
                        likes: true,
                        comments: true,
                        followers: true,
                        following: true,
                    },
                },
            },
        });

        users = legacyUsers.map((user) => ({
            ...user,
            isAdmin: false,
        }));
    }

    const lastActivityRows = users.length
        ? await db.pageView.groupBy({
            by: ["userId"],
            where: {
                userId: {
                    in: users.map((user) => user.id),
                },
            },
            _max: {
                createdAt: true,
            },
        })
        : [];
    const lastActivityByUserId = new Map(
        lastActivityRows.map((row) => [row.userId, row._max.createdAt?.toISOString() ?? null]),
    );

    const canManageUsers = await hasSuperAdminAccessByEmail(session.user.email);

    const usersWithActivity = users
        .filter((user) => user.email?.toLowerCase() !== session.user.email?.toLowerCase())
        .map((user) => ({
            ...user,
            isConfiguredAdmin: isConfiguredAdminEmail(user.email),
            hasAdminAccess: getUserAdminStatus(user),
            lastActiveAt: lastActivityByUserId.get(user.id) ?? null,
        }));

    return NextResponse.json({ users: usersWithActivity, canManageUsers });
}
