// app/api/user/privacy/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

// GET current user's privacy setting
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Select only what we need
    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, isPrivate: true },
    });

    if (!me) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ isPrivate: me.isPrivate });
}

// POST to update current user's privacy setting
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const nextIsPrivate = typeof body?.isPrivate === "boolean" ? body.isPrivate : undefined;
    if (typeof nextIsPrivate !== "boolean") {
        return NextResponse.json({ message: "Missing or invalid `isPrivate` boolean." }, { status: 400 });
    }

    const me = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, isPrivate: true } });
    if (!me) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Update flag
    const updated = await db.user.update({
        where: { id: me.id },
        data: { isPrivate: nextIsPrivate },
        select: { isPrivate: true },
    });

    // (Optional) If switching from private -> public, you may want to auto-accept pending requests:
    // if (me.isPrivate && !nextIsPrivate) {
    //   await db.follow.updateMany({
    //     where: { followingId: me.id, status: "PENDING" },
    //     data: { status: "ACCEPTED" },
    //   });
    // }

    return NextResponse.json({ isPrivate: updated.isPrivate });
}
