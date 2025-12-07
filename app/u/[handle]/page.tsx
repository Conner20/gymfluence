// app/u/[handle]/page.tsx
import { notFound, redirect } from "next/navigation";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { TraineeProfile } from "@/components/TraineeProfile";
import { TrainerProfile } from "@/components/TrainerProfile";
import { GymProfile } from "@/components/GymProfile";
import MobileHeader from "@/components/MobileHeader";

export default async function UserProfilePage({
    params,
}: {
    params: Promise<{ handle: string }>;
}) {
    // 👇 await dynamic params (Next.js “sync dynamic APIs” fix)
    const { handle } = await params;

    const decoded = decodeURIComponent(handle);
    const session = await getServerSession(authOptions);

    // If the handle belongs to the current user, send them to /profile
    if (
        session?.user?.username?.toLowerCase() === decoded.toLowerCase() ||
        session?.user?.id === decoded
    ) {
        redirect("/profile");
    }

    // Fetch only the user + profiles (NO posts here; posts are gated via API)
    const user = await db.user.findUnique({
        where: { username: decoded },
        include: {
            traineeProfile: true,
            trainerProfile: true,
            gymProfile: true,
        },
    });

    if (!user) return notFound();

    const shell = (children: React.ReactNode) => (
        <div className="min-h-screen flex flex-col bg-[#f8f8f8]">
            <MobileHeader title={user.username ?? "profile"} href={`/u/${encodeURIComponent(user.username ?? "")}`} />
            {/* Desktop header */}
            <header className="hidden lg:flex sticky top-0 z-30 w-full bg-white">
                <div className="py-6 flex justify-start pl-[40px]">
                    <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                        <span>{user.username}</span>
                    </h1>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 w-full">
                {children}
            </main>
        </div>
    );


    switch (user.role) {
        case "TRAINEE":
            return shell(<TraineeProfile user={user} />);
        case "TRAINER":
            return shell(<TrainerProfile user={user} />);
        case "GYM":
            return shell(<GymProfile user={user} />);
        default:
            return <div className="p-8 text-red-500">Unknown role</div>;
    }
}
