import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email.toLowerCase() },
        select: { id: true },
    });
    if (!me) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

    const [startsWith, contains] = q
        ? await Promise.all([
              db.user.findMany({
                  where: {
                      id: { not: me.id },
                      username: {
                          not: null,
                          startsWith: q,
                          mode: "insensitive",
                      },
                  },
                  select: {
                      id: true,
                      username: true,
                      name: true,
                      image: true,
                      role: true,
                      gymProfile: { select: { name: true } },
                  },
                  take: 5,
              }),
              db.user.findMany({
                  where: {
                      id: { not: me.id },
                      username: {
                          not: null,
                          contains: q,
                          mode: "insensitive",
                      },
                  },
                  select: {
                      id: true,
                      username: true,
                      name: true,
                      image: true,
                      role: true,
                      gymProfile: { select: { name: true } },
                  },
                  take: 10,
              }),
          ])
        : await Promise.all([
              db.user.findMany({
                  where: {
                      id: { not: me.id },
                      username: { not: null },
                  },
                  orderBy: { username: "asc" },
                  select: {
                      id: true,
                      username: true,
                      name: true,
                      image: true,
                      role: true,
                      gymProfile: { select: { name: true } },
                  },
                  take: 5,
              }),
              Promise.resolve([]),
          ]);

    const items = [...startsWith, ...contains]
        .filter((user, index, array) => user.username && array.findIndex((candidate) => candidate.id === user.id) === index)
        .slice(0, 5)
        .map((user) => ({
            id: user.id,
            username: user.username!,
            name: user.role === "GYM" ? user.gymProfile?.name || user.name : user.name,
            image: user.image,
        }));

    return NextResponse.json({ items });
}
