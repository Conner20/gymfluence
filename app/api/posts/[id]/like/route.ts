import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const postId = params.id;
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    // Check if THIS user has liked THIS post
    const existing = await db.like.findUnique({
        where: { postId_userId: { postId, userId: user.id } }
    });

    if (existing) {
        // Only remove the like for the current user
        await db.like.delete({ where: { id: existing.id } });
        return NextResponse.json({ liked: false });
    } else {
        await db.like.create({ data: { postId, userId: user.id } });
        return NextResponse.json({ liked: true });
    }
}