import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { path, visitorId, origin } = await req.json().catch(() => ({}));
        if (typeof path !== "string" || !path.length) {
            return NextResponse.json({ message: "Missing path" }, { status: 400 });
        }

        let userId: string | null = null;
        const session = await getServerSession(authOptions);
        if (session?.user?.email) {
            const user = await db.user.findUnique({
                where: { email: session.user.email },
                select: { id: true },
            });
            userId = user?.id ?? null;
        }

        await db.pageView.create({
            data: {
                path,
                origin: typeof origin === "string" && origin.length ? origin : null,
                userId,
                visitorId: typeof visitorId === "string" && visitorId.length ? visitorId : null,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[page-view]", error);
        return NextResponse.json({ message: "Failed to track" }, { status: 500 });
    }
}
