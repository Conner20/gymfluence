import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";
import { hash, compare } from "bcrypt";
import { z } from "zod";

const passwordSchema = z.object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "New password must be at least 8 characters long"),
});

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = passwordSchema.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json(
            { message: parsed.error.flatten().fieldErrors?.newPassword?.[0] || "Invalid payload." },
            { status: 400 }
        );
    }

    const { currentPassword, newPassword } = parsed.data;

    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, password: true },
    });
    if (!me) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (me.password) {
        if (!currentPassword) {
            return NextResponse.json({ message: "Current password is required." }, { status: 400 });
        }
        const matches = await compare(currentPassword, me.password);
        if (!matches) {
            return NextResponse.json({ message: "Current password is incorrect." }, { status: 401 });
        }
    }

    const hashed = await hash(newPassword, 10);
    await db.user.update({
        where: { id: me.id },
        data: { password: hashed },
    });

    return NextResponse.json({ message: "Password updated." });
}
