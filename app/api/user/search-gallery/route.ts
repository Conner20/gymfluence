// app/api/user/search-gallery/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

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

async function galleryDirFor(userId: string) {
    const dir = path.join(process.cwd(), "public", "uploads", "search-gallery", userId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

function toPublicUrl(userId: string, filename: string) {
    return `/uploads/search-gallery/${userId}/${filename}`;
}

// GET: list my gallery images
export async function GET() {
    const me = await resolveUserIdFromSession();
    if (!me) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const dir = await galleryDirFor(me.userId);
    const entries = await fs.readdir(dir).catch(() => []);
    const urls = entries
        .filter((f) => !f.startsWith("."))
        .map((f) => toPublicUrl(me.userId, f));

    return NextResponse.json({ urls });
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

    const dir = await galleryDirFor(me.userId);
    const urls: string[] = [];

    for (const file of files) {
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ message: "Only images are allowed" }, { status: 400 });
        }
        if (file.size > 8 * 1024 * 1024) {
            return NextResponse.json({ message: "Image too large (8MB max)" }, { status: 400 });
        }

        const buf = Buffer.from(await file.arrayBuffer());
        const ext =
            file.type === "image/png"
                ? "png"
                : file.type === "image/webp"
                    ? "webp"
                    : file.type === "image/gif"
                        ? "gif"
                        : "jpg";
        const base = `sg-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
        await fs.writeFile(path.join(dir, base), buf);
        urls.push(toPublicUrl(me.userId, base));
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

    // Ensure the file is inside the caller's gallery
    const prefix = `/uploads/search-gallery/${me.userId}/`;
    if (!url.startsWith(prefix)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const rel = url.slice(prefix.length);
    const filePath = path.join(process.cwd(), "public", "uploads", "search-gallery", me.userId, rel);

    try {
        await fs.unlink(filePath);
    } catch {
        // ignore missing
    }

    return NextResponse.json({ ok: true });
}
