import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

async function ensureUploadsDir() {
    const dir = path.join(process.cwd(), "public", "uploads", "avatars");
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, name: true, username: true, image: true, location: true, bio: true, email: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    return NextResponse.json(me);
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const ct = req.headers.get("content-type") || "";
    let name: string | undefined;
    let location: string | undefined;
    let bio: string | undefined;
    let newImageUrl: string | undefined;

    if (ct.includes("multipart/form-data")) {
        const form = await req.formData();
        name = String(form.get("name") ?? "") || undefined;
        location = String(form.get("location") ?? "") || undefined;
        bio = String(form.get("bio") ?? "") || undefined;

        const file = form.get("image");
        if (file && file instanceof File && file.size > 0) {
            const ok = file.type.startsWith("image/");
            if (!ok) return NextResponse.json({ message: "Invalid file type" }, { status: 400 });
            if (file.size > 8 * 1024 * 1024) return NextResponse.json({ message: "Image too large (8MB max)" }, { status: 400 });

            const buf = Buffer.from(await file.arrayBuffer());
            const ext = file.type === "image/png" ? "png"
                : file.type === "image/webp" ? "webp"
                    : file.type === "image/gif" ? "gif"
                        : "jpg";
            const base = `avatar-${me.id}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
            const dir = await ensureUploadsDir();
            await fs.writeFile(path.join(dir, base), buf);
            newImageUrl = `/uploads/avatars/${base}`;
        }
    } else {
        const body = await req.json().catch(() => ({}));
        name = body?.name || undefined;
        location = body?.location || undefined;
        bio = body?.bio || undefined;
        newImageUrl = body?.imageUrl || undefined;
    }

    const updated = await db.user.update({
        where: { id: me.id },
        data: {
            ...(name !== undefined ? { name } : {}),
            ...(location !== undefined ? { location } : {}),
            ...(bio !== undefined ? { bio } : {}),
            ...(newImageUrl ? { image: newImageUrl } : {}),
        },
        select: { id: true, name: true, username: true, image: true, location: true, bio: true },
    });

    return NextResponse.json(updated);
}
