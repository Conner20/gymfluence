import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";
import { env } from "@/lib/env";

function isAdminEmail(email: string | null | undefined) {
    if (!email) return false;
    const list = env.ADMIN_EMAILS.split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
    return list.includes(email.toLowerCase());
}

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminEmail(session.user.email)) {
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

    const users = await db.user.findMany({
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

    const deletableUsers = users.filter((user) => !isAdminEmail(user.email));

    return NextResponse.json({ users: deletableUsers });
}
