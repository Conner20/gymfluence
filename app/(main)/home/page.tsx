// app/(main)/home/page.tsx
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/prisma/client";
import HomePageShell from "@/components/HomePageShell";
import { isAdminEmail } from "@/lib/admin";

export const revalidate = 0; // always fresh server render

export default async function Home() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        redirect("/");
    }

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

    const formatted = posts.map((p: typeof posts[number]) => {
        const commentCount =
            p.comments.length +
            p.comments.reduce(
                (s: number, c: typeof p.comments[number]) =>
                    s + (c.replies?.length ?? 0),
                0
            );

        return {
            ...p,
            likeCount: p.likes.length,
            didLike: viewerId
                ? p.likes.some((l: typeof p.likes[number]) => l.userId === viewerId)
                : false,
            commentCount,
        };
    });

    const isAdmin = isAdminEmail(session.user.email);

    return <HomePageShell posts={formatted as any} isAdmin={isAdmin} />;
}
