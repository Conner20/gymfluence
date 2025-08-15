import { NextResponse } from "next/server";
import { db } from "@/prisma/client";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: userId } = await params;

    // People `userId` is following
    const rows = await db.follow.findMany({
        where: { followerId: userId },
        include: {
            following: {
                select: { id: true, username: true, name: true, image: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    const users = rows.map(r => r.following);
    return NextResponse.json(users);
}
