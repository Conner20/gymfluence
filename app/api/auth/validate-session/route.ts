import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ valid: false }, { status: 401 });
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email.toLowerCase() },
        select: { id: true },
    });

    if (!user) {
        return NextResponse.json({ valid: false }, { status: 404 });
    }

    return NextResponse.json({ valid: true });
}
