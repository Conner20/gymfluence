import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { compare } from "bcrypt";

import { authOptions } from "@/lib/auth";
import { hasAdminAccessByEmail } from "@/lib/admin";
import { db } from "@/prisma/client";

type Params = {
    params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await hasAdminAccessByEmail(session.user.email))) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const admin = await db.user.findUnique({
        where: { email: session.user.email.toLowerCase() },
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

    if (!password || typeof password !== "string") {
        return NextResponse.json({ message: "Password is required." }, { status: 400 });
    }

    const matches = await compare(password, admin.password);
    if (!matches) {
        return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
    }

    const { id } = await params;
    const target = await db.user.findUnique({
        where: { id },
        select: {
            id: true,
            role: true,
            gymProfile: {
                select: {
                    userId: true,
                    isVerified: true,
                },
            },
        },
    });

    if (!target || target.role !== "GYM" || !target.gymProfile) {
        return NextResponse.json({ message: "Gym user not found." }, { status: 404 });
    }

    if (target.gymProfile.isVerified) {
        return NextResponse.json({ message: "Gym is already verified." });
    }

    await db.gymProfile.update({
        where: { userId: target.id },
        data: { isVerified: true },
    });

    return NextResponse.json({
        message: "Gym verified.",
        gymProfile: {
            isVerified: true,
        },
    });
}
