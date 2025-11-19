// app/(main)/home/page.tsx
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { db } from "@/prisma/client";
import HomePosts from "@/components/HomePosts";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export const revalidate = 0; // always fresh server render

export default async function Home() {
    const session = await getServerSession(authOptions);

    // Resolve the viewer's user id (if signed in)
    const viewerId = session?.user?.email
        ? (
            await db.user.findUnique({
                where: { email: session.user.email },
                select: { id: true },
            })
        )?.id ?? null
        : null;

    // Visibility rules:
    // - Public authors (isPrivate=false): always visible
    // - Private authors (isPrivate=true): visible only if viewer follows them with status=ACCEPTED
    const posts = await db.post.findMany({
        where: viewerId
            ? {
                OR: [
                    { author: { isPrivate: false } },
                    {
                        author: {
                            isPrivate: true,
                            // viewer must be an accepted follower
                            followers: {
                                some: {
                                    followerId: viewerId,
                                    status: "ACCEPTED",
                                },
                            },
                        },
                    },
                ],
            }
            : {
                // not signed in → only public authors' posts
                author: { isPrivate: false },
            },
        include: {
            author: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    image: true,
                    role: true,
                    isPrivate: true,
                },
            },
            likes: { select: { userId: true } },
            comments: {
                where: { parentId: null },
                orderBy: { createdAt: "asc" },
                include: {
                    author: { select: { username: true, email: true } },
                    replies: {
                        orderBy: { createdAt: "asc" },
                        include: {
                            author: { select: { username: true, email: true } },
                        },
                    },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 10, // 🔹 only 10 posts on initial load
    });

    const formatted = posts.map((p) => {
        const commentCount =
            p.comments.length +
            p.comments.reduce((s, c) => s + (c.replies?.length ?? 0), 0);

        return {
            ...p,
            likeCount: p.likes.length,
            didLike: viewerId ? p.likes.some((l) => l.userId === viewerId) : false,
            commentCount,
        };
    });

    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <header className="w-full bg-white py-6 flex justify-center items-center z-20">
                <h1 className="font-serif font-bold text-3xl text-green-700 tracking-tight select-none">
                    <Link href="/">
                        <span className="cursor-pointer">gymfluence</span>
                    </Link>
                </h1>
            </header>

            <main className="flex-1 w-full flex justify-center">
                {/* Pass the filtered posts down; component can use or ignore this prop */}
                <HomePosts initialPosts={formatted as any} />
            </main>
            <Navbar />
        </div>
    );
}
