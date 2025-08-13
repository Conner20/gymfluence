// app/u/[handle]/page.tsx
import { notFound } from "next/navigation";
import { db } from "@/prisma/client";

// Import your client components (it's fine to render client comps from a server page)
import { TraineeProfile } from "@/components/TraineeProfile";
import { TrainerProfile } from "@/components/TrainerProfile";
import { GymProfile } from "@/components/GymProfile"; // where GymProfile is exported

export default async function UserProfilePage({ params }: { params: { handle: string } }) {
    const handle = decodeURIComponent(params.handle);

    const user = await db.user.findUnique({
        where: { username: handle },
        include: {
            traineeProfile: true,
            trainerProfile: true,
            gymProfile: true,
            post: {
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!user) return notFound();

    const posts = user.post;

    switch (user.role) {
        case "TRAINEE":
            return <div className="min-h-screen bg-[#f8f8f8]">
                <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
                    <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                        <span>{user.username}</span>
                    </h1>
                </header>
                <TraineeProfile user={user} posts={posts} />;
            </div>

        case "TRAINER":
            return <div className="min-h-screen bg-[#f8f8f8]">
                <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
                    <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                        <span>{user.username}</span>
                    </h1>
                </header>
                <TrainerProfile user={user} posts={posts} />;
            </div>
        case "GYM":
            return <div className="min-h-screen bg-[#f8f8f8]">
                <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
                    <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                        <span>{user.username}</span>
                    </h1>
                </header>
                <GymProfile user={user} posts={posts} />;
            </div>
        default:
            return <div className="p-8 text-red-500">Unknown role</div>;
    }

    switch (user.role) {
        case "TRAINEE":
            return <TraineeProfile user={user} posts={posts} />;
        case "TRAINER":
            return <TrainerProfile user={user} posts={posts} />;
        case "GYM":
            return <GymProfile user={user} posts={posts} />;
        default:
            return notFound();
    }
}
