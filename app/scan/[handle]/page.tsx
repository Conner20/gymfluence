import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

export default async function ScanRedirectPage({
    params,
}: {
    params: Promise<{ handle: string }>;
}) {
    const { handle } = await params;
    const session = await getServerSession(authOptions);

    const target = await db.user.findUnique({
        where: { username: handle },
        select: { username: true },
    });

    if (!target?.username) {
        redirect("/");
    }

    if (!session?.user?.email) {
        redirect("/");
    }

    redirect(`/u/${encodeURIComponent(target.username)}`);
}
