import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasAdminAccessByEmail } from "@/lib/admin";
import { db } from "@/prisma/client";

type Params = {
    params: Promise<{ id: string }>;
};

export async function GET(req: Request, { params }: Params) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await hasAdminAccessByEmail(session.user.email))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const take = Math.min(Math.max(Number(searchParams.get("limit") || 200), 1), 500);

    const activity = await db.pageView.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take,
        select: {
            id: true,
            path: true,
            createdAt: true,
        },
    });

    return NextResponse.json({ activity });
}
