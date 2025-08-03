// import { authOptions } from "@/lib/auth";
// import { getServerSession } from "next-auth";
import { db } from "@/prisma/client";
import HomePosts from "@/components/HomePosts";

export default async function Home() {
    // const session = await getServerSession(authOptions);
    const posts = await db.post.findMany({
        orderBy: { createdAt: "desc" },
        include: { author: true },
    });

    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <header className="w-full bg-white py-6 flex justify-center items-center z-20">
                <h1 className="font-serif font-bold text-3xl text-green-700 tracking-tight select-none">
                    <span>gymfluence</span>
                </h1>
            </header>
            <main className="flex-1 w-full flex justify-center">
                <HomePosts />
            </main>
        </div>
    );
}
