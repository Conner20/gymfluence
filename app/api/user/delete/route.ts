import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";
import { compare } from "bcrypt";

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const password = body?.password;
    if (!password) {
        return NextResponse.json({ message: "Password is required." }, { status: 400 });
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, password: true },
    });

    if (!me) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (!me.password) {
        return NextResponse.json(
            { message: "This account does not have a password set. Please contact support." },
            { status: 400 },
        );
    }

    const matches = await compare(password, me.password);
    if (!matches) {
        return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
    }

    await db.$transaction([
        db.like.deleteMany({ where: { userId: me.id } }),
        db.comment.deleteMany({ where: { authorId: me.id } }),
        db.follow.deleteMany({
            where: {
                OR: [{ followerId: me.id }, { followingId: me.id }],
            },
        }),
        db.message.deleteMany({
            where: {
                OR: [{ senderId: me.id }, { sharedUserId: me.id }],
            },
        }),
        db.post.deleteMany({ where: { authorId: me.id } }),
        db.user.delete({ where: { id: me.id } }),
    ]);

    return NextResponse.json({ message: "Account deleted." }, { status: 200 });
}
