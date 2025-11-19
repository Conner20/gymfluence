// app/api/user/search-gallery/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";
import { storeImageFile, deleteStoredFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveUserIdFromSession(): Promise<{ userId: string } | null> {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return null;

    const me = await db.user.findUnique({
        where: { email },
        select: { id: true },
    });
    if (!me) return null;

    return { userId: me.id };
}

// GET: list my gallery images
export async function GET() {
    const me = await resolveUserIdFromSession();
    if (!me) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const images = await db.searchGalleryImage.findMany({
        where: { userId: me.userId },
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { url: true },
    });

    return NextResponse.json({
        urls: images.map((img: typeof images[number]) => img.url),
    });
}

// POST: upload images (multipart/form-data, field name: "images")
export async function POST(req: Request) {
    const me = await resolveUserIdFromSession();
    if (!me) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
        return NextResponse.json({ message: "Expected multipart/form-data" }, { status: 400 });
    }

    const form = await req.formData();
    const files = form.getAll("images").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
        return NextResponse.json({ message: "No files provided" }, { status: 400 });
    }
    if (files.length > 12) {
        return NextResponse.json({ message: "Maximum 12 files per upload" }, { status: 400 });
    }

    const existingCount = await db.searchGalleryImage.count({ where: { userId: me.userId } });
    if (existingCount + files.length > 60) {
        return NextResponse.json({ message: "Gallery limit reached (max 60 images)" }, { status: 400 });
    }

    const urls: string[] = [];

    for (const file of files) {
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ message: "Only images are allowed" }, { status: 400 });
        }
        if (file.size > 8 * 1024 * 1024) {
            return NextResponse.json({ message: "Image too large (8MB max)" }, { status: 400 });
        }

        const uploaded = await storeImageFile(file, {
            folder: `search-gallery/${me.userId}`,
            prefix: `sg-${me.userId}`,
        });

        await db.searchGalleryImage.create({
            data: {
                userId: me.userId,
                url: uploaded.url,
            },
        });

        urls.push(uploaded.url);
    }

    return NextResponse.json({ urls });
}

// DELETE: remove one image from my gallery
// Accepts: JSON body { url: string } OR query ?url=...
export async function DELETE(req: Request) {
    const me = await resolveUserIdFromSession();
    if (!me) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    let url = new URL(req.url).searchParams.get("url");
    if (!url) {
        try {
            const body = await req.json();
            url = body?.url;
        } catch {
            // ignore
        }
    }
    if (!url) {
        return NextResponse.json({ message: "Missing url" }, { status: 400 });
    }

    const image = await db.searchGalleryImage.findFirst({
        where: {
            userId: me.userId,
            url,
        },
        select: { id: true, url: true },
    });
    if (!image) {
        return NextResponse.json({ message: "Image not found" }, { status: 404 });
    }

    await db.searchGalleryImage.delete({ where: { id: image.id } });
    await deleteStoredFile(image.url);

    return NextResponse.json({ ok: true });
}
