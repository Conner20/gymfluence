import { NextResponse } from "next/server";

import { db } from "@/prisma/client";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (!q || q.length < 2) {
        return NextResponse.json({ results: [] });
    }

    const trainers = await db.user.findMany({
        where: {
            role: "TRAINER",
            OR: [
                { username: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
            ],
        },
        select: {
            id: true,
            username: true,
            name: true,
        },
        orderBy: {
            username: "asc",
        },
        take: 8,
    });

    return NextResponse.json({
        results: trainers.map((trainer) => ({
            id: trainer.id,
            username: trainer.username,
            name: trainer.name,
        })),
    });
}
