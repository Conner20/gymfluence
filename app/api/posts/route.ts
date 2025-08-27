import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// Helpers
async function ensureUploadsDir() {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    try {
        await fs.mkdir(uploadsDir, { recursive: true });
    } catch { }
    return uploadsDir;
}

function safeExt(mime: string, fallback = "bin") {
    // Very small allowlist; extend as you like
    if (mime === "image/png") return "png";
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/webp") return "webp";
    if (mime === "image/gif") return "gif";
    return fallback;
}

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
                    return NextResponse.json({ message: "Image too large (max 8MB)." }, { status: 400 });
                }
                const mime = file.type || "application/octet-stream";
                if (!mime.startsWith("image/")) {
                    return NextResponse.json({ message: "Only image uploads are allowed." }, { status: 400 });
                }

                const buf = Buffer.from(await file.arrayBuffer());
                const ext = safeExt(mime);
                const hash = crypto.randomBytes(8).toString("hex");
                const base = `post-${user.id}-${Date.now()}-${hash}.${ext}`;

                const uploadsDir = await ensureUploadsDir();
                const outPath = path.join(uploadsDir, base);
                await fs.writeFile(outPath, buf);

                // Public URL under /public
                imageUrl = `/uploads/${base}`;
            }
        } else {
            // Back-compat: JSON body (no file)
            const body = await req.json();
            title = String(body.title || "").trim();
            content = String(body.content || "").trim();
            imageUrl = body.imageUrl ? String(body.imageUrl) : null; // in case you pre-upload elsewhere (S3/Cloudinary)
        }

        if (!title || !content) {
            return NextResponse.json({ message: "Title and content are required." }, { status: 400 });
        }

        const newPost = await db.post.create({
            data: {
                title,
                content,
                imageUrl,
                authorId: user.id,
            },
        });

        return NextResponse.json({ post: newPost, message: "Post created!" }, { status: 201 });
    } catch (error) {
        console.error("POST /api/posts error:", error);
        return NextResponse.json({ message: "Failed to create post." }, { status: 500 });
    }
}

// Fetch posts with privacy rules (unchanged logic you already have):
// - Public authors visible to everyone
// - Private authors visible to followers
// - Viewer always sees their own posts
export async function GET(_req: Request) {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? null;

    let currentUserId: string | null = null;
    if (userEmail) {
        const me = await db.user.findUnique({
            where: { email: userEmail },
            select: { id: true },
        });
        currentUserId = me?.id ?? null;
    }

    try {
        let followedIds: string[] = [];
        if (currentUserId) {
            const following = await db.follow.findMany({
                where: { followerId: currentUserId, status: "ACCEPTED" },
                select: { followingId: true },
            });
            followedIds = following.map(f => f.followingId);
        }

        const whereFilter = {
            OR: [
                { author: { isPrivate: false } },
                ...(currentUserId ? [{ authorId: { in: followedIds } }] : []),
                ...(currentUserId ? [{ authorId: currentUserId }] : []),
            ],
        };

        const posts = await db.post.findMany({
            where: whereFilter,
            orderBy: { createdAt: "desc" },
            include: {
                author: true,
                likes: true,
                comments: {
                    where: { parentId: null },
                    orderBy: { createdAt: "asc" },
                    include: {
                        author: true,
                        replies: {
                            orderBy: { createdAt: "asc" },
                            include: { author: true },
                        },
                    },
                },
            },
        });

        const formatted = posts.map(post => ({
            id: post.id,
            title: post.title,
            content: post.content,
            imageUrl: post.imageUrl ?? null,
            createdAt: post.createdAt,
            author: {
                id: post.author?.id ?? "",
                username: post.author?.username ?? null,
                name: post.author?.name ?? null,
                image: post.author?.image ?? null,
                isPrivate: !!post.author?.isPrivate,
            },
            likeCount: post.likes.length,
            didLike: currentUserId
                ? post.likes.some(like => like.userId === currentUserId)
                : false,
            commentCount:
                post.comments.length +
                post.comments.reduce((sum, c) => sum + (c.replies?.length ?? 0), 0),
            comments: post.comments.map(comment => ({
                id: comment.id,
                content: comment.content,
                createdAt: comment.createdAt,
                author: {
                    username: comment.author?.username ?? null,
                    email: comment.author?.email ?? null,
                },
                replies: comment.replies.map(reply => ({
                    id: reply.id,
                    content: reply.content,
                    createdAt: reply.createdAt,
                    author: {
                        username: reply.author?.username ?? null,
                        email: reply.author?.email ?? null,
                    },
                })),
            })),
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error("GET /api/posts error:", error);
        return NextResponse.json({ message: "Failed to fetch posts." }, { status: 500 });
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
        return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }

    if (post.author?.email !== session.user.email) {
        return NextResponse.json({ message: "Forbidden: You can only delete your own posts." }, { status: 403 });
    }

    await db.post.delete({ where: { id } });

    return NextResponse.json({ message: "Post deleted." }, { status: 200 });
}
