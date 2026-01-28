import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";
import { compare } from "bcrypt";
import { env } from "@/lib/env";

function isAdminEmail(email: string | null | undefined) {
    if (!email) return false;
    const adminList = env.ADMIN_EMAILS.split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
    return adminList.includes(email.toLowerCase());
}

async function deleteUserAndRelations(userId: string) {
    await db.$transaction([
        db.like.deleteMany({ where: { userId } }),
        db.comment.deleteMany({ where: { authorId: userId } }),
        db.follow.deleteMany({
            where: {
                OR: [{ followerId: userId }, { followingId: userId }],
            },
        }),
        db.message.deleteMany({
            where: {
                OR: [{ senderId: userId }, { sharedUserId: userId }],
            },
        }),
        db.post.deleteMany({ where: { authorId: userId } }),
        db.user.delete({ where: { id: userId } }),
    ]);
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const password = body?.password;
    const targetUserId = body?.targetUserId?.trim();
    const targetEmail =
        typeof body?.targetEmail === "string" ? body.targetEmail.trim().toLowerCase() : undefined;

    if (!password) {
        return NextResponse.json({ message: "Password is required." }, { status: 400 });
    }

    const requester = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, password: true, email: true },
    });

    if (!requester) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (!requester.password) {
        return NextResponse.json(
            { message: "This account does not have a password set. Please contact support." },
            { status: 400 },
        );
    }

    const matches = await compare(password, requester.password);
    if (!matches) {
        return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
    }

    const hasAdminPrivileges = isAdminEmail(requester.email);

    let targetId = requester.id;
    if (targetUserId || targetEmail) {
        if (!hasAdminPrivileges) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const targetUser = await db.user.findFirst({
            where: {
                OR: [
                    ...(targetUserId ? [{ id: targetUserId }] : []),
                    ...(targetEmail ? [{ email: targetEmail }] : []),
                ],
            },
            select: { id: true, email: true },
        });

        if (!targetUser) {
            return NextResponse.json({ message: "Target user not found." }, { status: 404 });
        }

        if (isAdminEmail(targetUser.email)) {
            return NextResponse.json(
                { message: "Admins cannot delete other admin accounts." },
                { status: 403 },
            );
        }

        targetId = targetUser.id;
    }

    await deleteUserAndRelations(targetId);

    const deletedSelf = targetId === requester.id;
    const message = deletedSelf ? "Account deleted." : "Target user deleted.";

    return NextResponse.json({ message }, { status: 200 });
}
