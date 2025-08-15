// app/u/[handle]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

// Client components are fine to render from a server page:
import { TraineeProfile } from "@/components/TraineeProfile";
import { TrainerProfile } from "@/components/TrainerProfile";
import { GymProfile } from "@/components/GymProfile";

export default async function UserProfilePage({
    params,
}: {
    params: { handle: string };
}) {
    const session = await getServerSession(authOptions);

    // IMPORTANT: decode first, then compare against the current user
    const handle = decodeURIComponent(params.handle);

    // If the handle belongs to the current user, send them to /profile.
    // Compare by username (case-insensitive) and also allow matching by id.
    if (
        (session?.user?.username &&
            handle.toLowerCase() === session.user.username.toLowerCase()) ||
        (session?.user?.id && handle === session.user.id)
    ) {
        redirect("/profile");
    }

    // Otherwise, load the target user by username
    const user = await db.user.findUnique({
        where: { username: handle },
        include: {
            traineeProfile: true,
            trainerProfile: true,
            gymProfile: true,
            post: { orderBy: { createdAt: "desc" } },
        },
    });

    if (!user) return notFound();

    const posts = user.post;

    const Header = (
        <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
            <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                <span>{user.username}</span>
            </h1>
        </header>
    );

    switch (user.role) {
        case "TRAINEE":
            return (
                <div className="min-h-screen bg-[#f8f8f8]">
                    {Header}
                    <TraineeProfile user={user} posts={posts} />
                </div>
            );

        case "TRAINER":
            return (
                <div className="min-h-screen bg-[#f8f8f8]">
                    {Header}
                    <TrainerProfile user={user} posts={posts} />
                </div>
            );

        case "GYM":
            return (
                <div className="min-h-screen bg-[#f8f8f8]">
                    {Header}
                    <GymProfile user={user} posts={posts} />
                </div>
            );

        default:
            return <div className="p-8 text-red-500">Unknown role</div>;
    }
}
