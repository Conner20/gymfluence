import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteStoredFile, storeImageFile } from "@/lib/storage";

const MAX_POST_IMAGES = 3;

export async function GET(
    _req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params; // ✅ await params

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

    const post = await db.post.findUnique({
        where: { id },
        include: {
            author: {
                select: { id: true, username: true, name: true, isPrivate: true },
            },
            likes: { select: { userId: true } },
            comments: {
                where: { parentId: null },
                orderBy: { createdAt: "asc" },
                include: {
                    author: { select: { username: true, email: true } },
                    replies: {
                        orderBy: { createdAt: "asc" },
                        include: { author: { select: { username: true, email: true } } },
                    },
                },
            },
        },
    });

    if (!post) {
        return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }

    // Privacy gate: private author & viewer is not author & not an accepted follower
    if (post.author.isPrivate && viewerId !== post.author.id) {
        const ok = viewerId
            ? await db.follow.findFirst({
                where: {
                    followerId: viewerId,
                    followingId: post.author.id,
                    status: "ACCEPTED",
                },
            })
            : null;

        if (!ok) {
            // 404 to mirror home feed behavior + give caller a hint to show CTA
            return NextResponse.json(
                {
                    message: "This post is private.",
                    author: { id: post.author.id, username: post.author.username },
                },
                { status: 404 }
            );
        }
    }

    const payload = {
        id: post.id,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl ?? null,
        imageUrls: post.imageUrls ?? [],
        createdAt: post.createdAt,
        author: {
            id: post.author.id,
            username: post.author.username,
            name: post.author.name,
        },
        likeCount: post.likes.length,
        didLike: viewerId
            ? post.likes.some((l: typeof post.likes[number]) => l.userId === viewerId)
            : false,
        commentCount:
            post.comments.length +
            post.comments.reduce(
                (s: number, c: typeof post.comments[number]) => s + (c.replies?.length ?? 0),
                0
            ),
        comments: post.comments.map((c: typeof post.comments[number]) => ({
            id: c.id,
            content: c.content,
            createdAt: c.createdAt,
            author: {
                username: c.author?.username ?? null,
                email: c.author?.email ?? null,
            },
            replies: c.replies.map((r: typeof c.replies[number]) => ({
                id: r.id,
                content: r.content,
                createdAt: r.createdAt,
                author: {
                    username: r.author?.username ?? null,
                    email: r.author?.email ?? null,
                },
            })),
        })),
    };

    return NextResponse.json(payload);
}

export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

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

    const post = await db.post.findUnique({
        where: { id },
        select: { id: true, authorId: true, imageUrl: true, imageUrls: true },
    });
    if (!post) {
        return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }
    if (post.authorId !== user.id) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const existingImageUrls = post.imageUrls?.length
        ? post.imageUrls
        : post.imageUrl
            ? [post.imageUrl]
            : [];

    const contentType = req.headers.get("content-type") || "";
    let title = "";
    let content = "";
    let nextImageUrls: string[] = [];

    if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        title = String(form.get("title") || "").trim();
        content = String(form.get("content") || "").trim();

        const retainedValue = String(form.get("retainedImageUrls") || "[]");
        let retainedImageUrls: string[] = [];
        try {
            const parsed = JSON.parse(retainedValue);
            if (Array.isArray(parsed)) {
                retainedImageUrls = parsed.map(String).filter(Boolean);
            }
        } catch {
            retainedImageUrls = [];
        }

        const allowedExisting = new Set(existingImageUrls);
        retainedImageUrls = retainedImageUrls.filter((url) => allowedExisting.has(url));

        const files = form
            .getAll("images")
            .filter((file): file is File => file instanceof File && file.size > 0);

        if (retainedImageUrls.length + files.length > MAX_POST_IMAGES) {
            return NextResponse.json({ message: "You can upload up to 3 images per post." }, { status: 400 });
        }

        for (const file of files) {
            const maxBytes = 8 * 1024 * 1024;
            if (file.size > maxBytes) {
                return NextResponse.json({ message: "Image too large (max 8MB)." }, { status: 400 });
            }
            const mime = file.type || "application/octet-stream";
            if (!mime.startsWith("image/")) {
                return NextResponse.json({ message: "Only image uploads are allowed." }, { status: 400 });
            }
        }

        const uploadedUrls: string[] = [];
        try {
            for (const file of files) {
                const uploaded = await storeImageFile(file, {
                    folder: "posts",
                    prefix: `post-${user.id}`,
                });
                uploadedUrls.push(uploaded.url);
            }
        } catch (err: any) {
            const msg =
                typeof err?.message === "string" && err.message.includes("Local uploads are not supported")
                    ? err.message
                    : "Failed to upload image";
            return NextResponse.json({ message: msg }, { status: 503 });
        }

        nextImageUrls = [...retainedImageUrls, ...uploadedUrls];
    } else {
        const body = await req.json().catch(() => ({}));
        title = String(body?.title || "").trim();
        content = String(body?.content || "").trim();
        nextImageUrls = Array.isArray(body?.imageUrls)
            ? body.imageUrls.map(String).filter(Boolean).slice(0, MAX_POST_IMAGES)
            : existingImageUrls;
    }

    if (!title || !content) {
        return NextResponse.json({ message: "Title and content are required." }, { status: 400 });
    }

    const previousUrls = Array.from(new Set(existingImageUrls));
    const removedUrls = previousUrls.filter((url) => !nextImageUrls.includes(url));

    const updated = await db.post.update({
        where: { id },
        data: {
            title,
            content,
            imageUrl: nextImageUrls[0] ?? null,
            imageUrls: nextImageUrls,
        },
        select: {
            id: true,
            title: true,
            content: true,
            imageUrl: true,
            imageUrls: true,
            createdAt: true,
        },
    });

    for (const url of removedUrls) {
        await deleteStoredFile(url);
    }

    return NextResponse.json({ post: updated });
}
