import { NextResponse } from "next/server";
import { db } from "@/prisma/client";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: userId } = await params;

    // People who follow `userId`
    const rows = await db.follow.findMany({
        where: { followingId: userId },
        include: {
            follower: {
                select: { id: true, username: true, name: true, image: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    const users = rows.map(r => r.follower);
    return NextResponse.json(users);
}
