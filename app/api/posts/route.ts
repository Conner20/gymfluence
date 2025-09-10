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
                where: { authorId },
                orderBy: { createdAt: "desc" },
                include: {
                    author: { select: { id: true, username: true, name: true } },
                    likes: { select: { userId: true } },
                    comments: {
                        where: { parentId: null },
                        select: { id: true },
                    },
                },
                take: 60,
            });

            const formatted = posts.map((p) => ({
                id: p.id,
                title: p.title,
                content: p.content,
                imageUrl: p.imageUrl ?? null,
                createdAt: p.createdAt,
                author: p.author ? { id: p.author.id, username: p.author.username, name: p.author.name } : null,
                likeCount: p.likes.length,
                didLike: viewerId ? p.likes.some((l) => l.userId === viewerId) : false,
                commentCount: p.comments.length, // (top-level only; replies loaded in PostComments)
            }));

            return NextResponse.json(formatted);
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

        // IMPORTANT: no `as const` and use relation filter with `is: {...}`
        const whereFilter =
            viewerId
                ? {
                    OR: [
                        { author: { is: { isPrivate: false } } },
                        { authorId: { in: followedIds } },
                        { authorId: viewerId },
                    ],
                }
                : { author: { is: { isPrivate: false } } };

        const posts = await db.post.findMany({
            where: whereFilter,
            orderBy: { createdAt: "desc" },
            include: {
                author: { select: { id: true, username: true, name: true } },
                likes: { select: { userId: true } },
                comments: {
                    where: { parentId: null },
                    select: { id: true },
                },
            },
            take: 60,
        });

        const formatted = posts.map((p) => ({
            id: p.id,
            title: p.title,
            content: p.content,
            imageUrl: p.imageUrl ?? null,
            createdAt: p.createdAt,
            author: p.author ? { id: p.author.id, username: p.author.username, name: p.author.name } : null,
            likeCount: p.likes.length,
            didLike: viewerId ? p.likes.some((l) => l.userId === viewerId) : false,
            commentCount: p.comments.length,
        }));

        return NextResponse.json(formatted);
    } catch (e) {
        console.error("GET /api/posts error:", e);
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
