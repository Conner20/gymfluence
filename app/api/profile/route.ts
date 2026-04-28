import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

const PROFILE_PAGE_SIZE = 9;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const session = await getServerSession(authOptions);
    const email = searchParams.get("email") ?? session?.user?.email ?? null;
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
            _count: {
                select: { post: true },
            },
            traineeProfile: {
                include: {
                    associatedTrainer: {
                        select: { id: true, username: true, name: true },
                    },
                },
            },
            trainerProfile: true,
            gymProfile: true,
        }
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Fetch posts for media grid
    const postsRaw = await db.post.findMany({
        where: { authorId: user.id },
        orderBy: { createdAt: "desc" },
        take: PROFILE_PAGE_SIZE,
        select: {
            id: true,
            title: true,
            type: true,
            pollQuestion: true,
            imageUrl: true,
            imageUrls: true,
        },
    });

    const posts = postsRaw.map((p: typeof postsRaw[number]) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        pollQuestion: p.pollQuestion ?? null,
        imageUrl: p.imageUrl ?? null,
        imageUrls: p.imageUrls ?? [],
    }));

    return NextResponse.json({ user, posts, totalPostCount: user._count.post });
}
