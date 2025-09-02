import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

// GET /api/share/preview?type=post&id=POST_ID
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id") || "";

    if (type !== "post" || !id) {
        return NextResponse.json({ message: "Bad request" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    let viewerId: string | null = null;
    if (session?.user?.email) {
        const me = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        viewerId = me?.id ?? null;
    }

    const post = await db.post.findUnique({
        where: { id },
        include: {
            author: { select: { id: true, username: true, name: true, isPrivate: true } },
        },
    });
    if (!post) return NextResponse.json({ post: null }, { status: 404 });

    // same privacy rule as above
    let canView = !post.author.isPrivate || viewerId === post.author.id;
    if (!canView && viewerId) {
        const rel = await db.follow.findFirst({
            where: {
                followerId: viewerId,
                followingId: post.author.id,
                status: "ACCEPTED",
            },
            select: { id: true },
        });
        canView = !!rel;
    }

    if (!canView) {
        // Signal "locked" to the client; keeping 403 lets clients simply ignore the preview.
        return NextResponse.json({ post: null, locked: true }, { status: 403 });
    }

    // lightweight card data
    return NextResponse.json({
        post: {
            id: post.id,
            title: post.title,
            imageUrl: post.imageUrl ?? null,
            author: {
                id: post.author.id,
                username: post.author.username,
                name: post.author.name,
            },
        },
    });
}
