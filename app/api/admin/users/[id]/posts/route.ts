import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { compare } from "bcrypt";

import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";
import { env } from "@/lib/env";

function isAdmin(email: string | null | undefined) {
    if (!email) return false;
    return env.ADMIN_EMAILS.split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
        .includes(email.toLowerCase());
}

type Params = {
    params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !isAdmin(session.user.email)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(_.url);
    const take = Math.min(Math.max(Number(searchParams.get("limit") || 25), 1), 100);

    const posts = await db.post.findMany({
        where: { authorId: id },
        orderBy: { createdAt: "desc" },
        take,
        select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            imageUrl: true,
        },
    });

    return NextResponse.json({ posts });
}

export async function DELETE(req: Request, { params }: Params) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !isAdmin(session.user.email)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const admin = await db.user.findUnique({
        where: { email: session.user.email },
        select: { password: true },
    });

    if (!admin?.password) {
        return NextResponse.json(
            { message: "Admin account does not have a password set." },
            { status: 400 },
        );
    }

    const body = await req.json().catch(() => ({}));
    const password = body?.password;
    const postId = body?.postId;

    if (!password || !postId) {
        return NextResponse.json({ message: "Password and postId are required." }, { status: 400 });
    }

    const matches = await compare(password, admin.password);
    if (!matches) {
        return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
    }

    const { id } = await params;
    const post = await db.post.findFirst({
        where: { id: postId, authorId: id },
        select: { id: true },
    });

    if (!post) {
        return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }

    await db.post.delete({ where: { id: post.id } });

    return NextResponse.json({ message: "Post deleted." });
}
