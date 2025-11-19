// app/api/posts/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { storeImageFile, deleteStoredFile } from "@/lib/storage";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 10; // 🔹 10 posts per request

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!user) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const contentType = req.headers.get("content-type") || "";

    try {
        let title = "";
        let content = "";
        let imageUrl: string | null = null;

        if (contentType.includes("multipart/form-data")) {
            // Handle form-data with optional file
            const form = await req.formData();
            title = String(form.get("title") || "").trim();
            content = String(form.get("content") || "").trim();

            const file = form.get("image");
            if (file && file instanceof File && file.size > 0) {
                const maxBytes = 8 * 1024 * 1024; // 8MB
                if (file.size > maxBytes) {
                    return NextResponse.json(
                        { message: "Image too large (max 8MB)." },
                        { status: 400 }
                    );
                }
                const mime = file.type || "application/octet-stream";
                if (!mime.startsWith("image/")) {
                    return NextResponse.json(
                        { message: "Only image uploads are allowed." },
                        { status: 400 }
                    );
                }

                try {
                    const uploaded = await storeImageFile(file, {
                        folder: "posts",
                        prefix: `post-${user.id}`,
                    });
                    imageUrl = uploaded.url;
                } catch (err: any) {
                    const msg =
                        typeof err?.message === "string" && err.message.includes("Local uploads are not supported")
                            ? err.message
                            : "Failed to upload image";
                    return NextResponse.json(
                        { message: msg },
                        { status: 503 }
                    );
                }
            }
        } else {
            // Back-compat: JSON body (no file)
            const body = await req.json();
            title = String(body.title || "").trim();
            content = String(body.content || "").trim();
            imageUrl = body.imageUrl ? String(body.imageUrl) : null; // in case you pre-upload elsewhere (S3/Cloudinary)
        }

        if (!title || !content) {
            return NextResponse.json(
                { message: "Title and content are required." },
                { status: 400 }
            );
        }

        const newPost = await db.post.create({
            data: {
                title,
                content,
                imageUrl,
                authorId: user.id,
            },
        });

        revalidateTag("posts");

        return NextResponse.json(
            { post: newPost, message: "Post created!" },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/posts error:", error);
        return NextResponse.json(
            { message: "Failed to create post." },
            { status: 500 }
        );
    }
}

// Fetch posts with privacy rules:
// - Public authors visible to everyone
// - Private authors visible to followers
// - Viewer always sees their own posts
// Supports pagination via ?cursor=<ISO createdAt>
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const viewerEmail = session?.user?.email ?? null;

    let viewerId: string | null = null;
    if (viewerEmail) {
        const me = await db.user.findUnique({
            where: { email: viewerEmail },
            select: { id: true },
        });
        viewerId = me?.id ?? null;
    }

    const { searchParams } = new URL(req.url);
    const authorId = searchParams.get("authorId");
    const cursorParam = searchParams.get("cursor");

    let cursorDate: Date | null = null;
    if (cursorParam) {
        const d = new Date(cursorParam);
        if (!Number.isNaN(d.getTime())) {
            cursorDate = d;
        }
    }

    // Helper to format posts (used for both profile + home)
    const formatPosts = (posts: any[]) =>
        posts.map((p) => ({
            id: p.id,
            title: p.title,
            content: p.content,
            imageUrl: p.imageUrl ?? null,
            createdAt: p.createdAt,
            author: p.author
                ? {
                    id: p.author.id,
                    username: p.author.username,
                    name: p.author.name,
                }
                : null,
            likeCount: p.likes.length,
            didLike: viewerId ? p.likes.some((l: any) => l.userId === viewerId) : false,
            commentCount:
                p.comments.length +
                p.comments.reduce(
                    (s: number, c: any) => s + (c.replies?.length ?? 0),
                    0
                ),
            comments: p.comments.map((c: any) => ({
                id: c.id,
                content: c.content,
                createdAt: c.createdAt,
                author: {
                    username: c.author?.username ?? null,
                    email: c.author?.email ?? null,
                },
                replies: c.replies.map((r: any) => ({
                    id: r.id,
                    content: r.content,
                    createdAt: r.createdAt,
                    author: {
                        username: r.author?.username ?? null,
                        email: r.author?.email ?? null,
                    },
                })),
            })),
        }));

    try {
        // ---------- PROFILE FEED (authorId provided) ----------
        if (authorId) {
            // privacy gate
            const author = await db.user.findUnique({
                where: { id: authorId },
                select: { id: true, isPrivate: true },
            });
            if (!author) return NextResponse.json([], { status: 200 });

            if (author.isPrivate && viewerId !== author.id) {
                const canSee = viewerId
                    ? await db.follow.findFirst({
                        where: {
                            followerId: viewerId,
                            followingId: author.id,
                            status: "ACCEPTED",
                        },
                        select: { id: true },
                    })
                    : null;

                if (!canSee) {
                    // Hide posts from non-followers of private accounts
                    return NextResponse.json([], { status: 200 });
                }
            }

            const posts = await db.post.findMany({
                where: {
                    authorId,
                    ...(cursorDate && { createdAt: { lt: cursorDate } }),
                },
                orderBy: { createdAt: "desc" },
                include: {
                    author: { select: { id: true, username: true, name: true } },
                    likes: { select: { userId: true } },
                    comments: {
                        where: { parentId: null },
                        orderBy: { createdAt: "asc" },
                        include: {
                            author: { select: { username: true, email: true } },
                            replies: {
                                orderBy: { createdAt: "asc" },
                                include: {
                                    author: {
                                        select: { username: true, email: true },
                                    },
                                },
                            },
                        },
                    },
                },
                take: PAGE_SIZE, // 🔹 10 per page
            });

            const formatted = formatPosts(posts);
            return NextResponse.json(formatted, {
                headers: { "Cache-Control": "no-store" },
            });
        }

        // ---------- HOME FEED (no authorId) ----------
        let followedIds: string[] = [];
        if (viewerId) {
            const following = await db.follow.findMany({
                where: { followerId: viewerId, status: "ACCEPTED" },
                select: { followingId: true },
            });
            followedIds = following.map((f) => f.followingId);
        }

        const baseWhere =
            viewerId
                ? {
                    OR: [
                        { author: { is: { isPrivate: false } } },
                        { authorId: { in: followedIds } },
                        { authorId: viewerId },
                    ],
                }
                : { author: { is: { isPrivate: false } } };

        const whereFilter = {
            AND: [
                baseWhere,
                ...(cursorDate ? [{ createdAt: { lt: cursorDate } }] : []),
            ],
        };

        const posts = await db.post.findMany({
            where: whereFilter,
            orderBy: { createdAt: "desc" },
            include: {
                author: { select: { id: true, username: true, name: true } },
                likes: { select: { userId: true } },
                comments: {
                    where: { parentId: null },
                    orderBy: { createdAt: "asc" },
                    include: {
                        author: { select: { username: true, email: true } },
                        replies: {
                            orderBy: { createdAt: "asc" },
                            include: {
                                author: {
                                    select: { username: true, email: true },
                                },
                            },
                        },
                    },
                },
            },
            take: PAGE_SIZE, // 🔹 10 per page
        });

        const formatted = formatPosts(posts);
        return NextResponse.json(formatted, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (e) {
        console.error("GET /api/posts error:", e);
        return NextResponse.json(
            { message: "Failed to fetch posts." },
            { status: 500 }
        );
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();

    const post = await db.post.findUnique({
        where: { id },
        include: { author: true },
    });

    if (!post) {
        return NextResponse.json(
            { message: "Post not found." },
            { status: 404 }
        );
    }

    if (post.author?.email !== session.user.email) {
        return NextResponse.json(
            { message: "Forbidden: You can only delete your own posts." },
            { status: 403 }
        );
    }

    await db.post.delete({ where: { id } });
    if (post.imageUrl) {
        await deleteStoredFile(post.imageUrl);
    }

    revalidateTag("posts");

    return NextResponse.json({ message: "Post deleted." }, { status: 200 });
}
