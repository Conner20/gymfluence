import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { compare } from "bcrypt";

import { authOptions } from "@/lib/auth";
import {
    getUserAdminStatus,
    hasAdminAccessByEmail,
    hasSuperAdminAccessByEmail,
    isConfiguredAdminEmail,
} from "@/lib/admin";
import { db } from "@/prisma/client";

type Params = {
    params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await hasAdminAccessByEmail(session.user.email))) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!(await hasSuperAdminAccessByEmail(session.user.email))) {
        return NextResponse.json({ message: "Only the super admin can change user privileges." }, { status: 403 });
    }

    const admin = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, password: true, email: true, isAdmin: true },
    });

    if (!admin?.password) {
        return NextResponse.json(
            { message: "Admin account does not have a password set." },
            { status: 400 },
        );
    }

    const body = await req.json().catch(() => ({}));
    const password = body?.password;
    const isAdmin = body?.isAdmin;

    if (!password || typeof isAdmin !== "boolean") {
        return NextResponse.json({ message: "Password and isAdmin are required." }, { status: 400 });
    }

    const matches = await compare(password, admin.password);
    if (!matches) {
        return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
    }

    const { id } = await params;
    const targetUser = await db.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            username: true,
            isAdmin: true,
        },
    });

    if (!targetUser) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (isConfiguredAdminEmail(targetUser.email)) {
        return NextResponse.json(
            { message: "This admin is managed by environment configuration and cannot be changed here." },
            { status: 403 },
        );
    }

    const updatedUser = await db.user.update({
        where: { id: targetUser.id },
        data: { isAdmin },
        select: {
            id: true,
            email: true,
            username: true,
            isAdmin: true,
        },
    });

    return NextResponse.json({
        user: {
            ...updatedUser,
            hasAdminAccess: getUserAdminStatus(updatedUser),
        },
        message: isAdmin ? "User promoted to admin." : "Admin privileges removed.",
    });
}
