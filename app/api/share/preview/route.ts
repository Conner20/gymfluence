// app/api/share/preview/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

/**
 * GET /api/share/preview?type=user|post&id=<id or username for user>
 * Returns a small payload for rendering a share card in the composer.
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") || "").toLowerCase();
    const id = searchParams.get("id") || "";

    if (!type || !id) {
        return NextResponse.json({ message: "Missing type or id" }, { status: 400 });
    }

    if (type === "user") {
        // allow username or id
        const user =
            (await db.user.findUnique({
                where: { id },
                select: { id: true, username: true, name: true, image: true },
            })) ||
            (await db.user.findUnique({
                where: { username: id },
                select: { id: true, username: true, name: true, image: true },
            }));

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
        return NextResponse.json({ type: "user", user });
    }

    if (type === "post") {
        const post = await db.post.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                content: true,
                imageUrl: true,
                author: { select: { id: true, username: true, name: true, image: true } },
            },
        });
        if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });
        return NextResponse.json({ type: "post", post });
    }

    return NextResponse.json({ message: "Invalid type" }, { status: 400 });
}
