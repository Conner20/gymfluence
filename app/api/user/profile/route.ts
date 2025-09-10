// app/user/profile/route.ts
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
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: {
            id: true,
            name: true,
            username: true,
            image: true,
            location: true,
            email: true,
            role: true,
            traineeProfile: { select: { bio: true } },
            trainerProfile: { select: { bio: true } },
            gymProfile: { select: { bio: true } },
        },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const bio =
        me.traineeProfile?.bio ??
        me.trainerProfile?.bio ??
        me.gymProfile?.bio ??
        null;

    return NextResponse.json({
        id: me.id,
        name: me.name,
        username: me.username,
        image: me.image,
        location: me.location,
        email: me.email,
        role: me.role,
        bio, // unified field for the settings form
    });
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: {
            id: true,
            role: true,
            traineeProfile: { select: { userId: true } },
            trainerProfile: { select: { userId: true } },
            gymProfile: { select: { userId: true } },
        },
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
            if (!file.type.startsWith("image/")) {
                return NextResponse.json({ message: "Invalid file type" }, { status: 400 });
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

    // Update common user fields
    await db.user.update({
        where: { id: me.id },
        data: {
            ...(name !== undefined ? { name } : {}),
            ...(location !== undefined ? { location } : {}),
            ...(newImageUrl ? { image: newImageUrl } : {}),
        },
    });

    // Write bio to the correct role profile (if provided)
    if (bio !== undefined) {
        if (me.role === "TRAINEE" && me.traineeProfile) {
            await db.traineeProfile.update({ where: { userId: me.id }, data: { bio } });
        } else if (me.role === "TRAINER" && me.trainerProfile) {
            await db.trainerProfile.update({ where: { userId: me.id }, data: { bio } });
        } else if (me.role === "GYM" && me.gymProfile) {
            await db.gymProfile.update({ where: { userId: me.id }, data: { bio } });
        }
        // If you want to be extra defensive, you could upsert here,
        // but typically each user already has the corresponding profile row.
    }

    // Return fresh snapshot with derived bio
    const out = await db.user.findUnique({
        where: { id: me.id },
        select: {
            id: true,
            name: true,
            username: true,
            image: true,
            location: true,
            role: true,
            traineeProfile: { select: { bio: true } },
            trainerProfile: { select: { bio: true } },
            gymProfile: { select: { bio: true } },
        },
    });

    const derivedBio =
        out?.traineeProfile?.bio ??
        out?.trainerProfile?.bio ??
        out?.gymProfile?.bio ??
        null;

    return NextResponse.json({
        id: out?.id,
        name: out?.name,
        username: out?.username,
        image: out?.image,
        location: out?.location,
        role: out?.role,
        bio: derivedBio,
    });
}
