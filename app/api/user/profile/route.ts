// app/api/user/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";
import { storeImageFile, deleteStoredFile } from "@/lib/storage";

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
            password: true,
            traineeProfile: {
                select: { bio: true, city: true, state: true, country: true, lat: true, lng: true },
            },
            trainerProfile: {
                select: { bio: true, city: true, state: true, country: true, lat: true, lng: true },
            },
            gymProfile: {
                select: { bio: true, city: true, state: true, country: true, lat: true, lng: true },
            },
        },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const profile =
        me.traineeProfile ??
        me.trainerProfile ??
        me.gymProfile ??
        null;

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
        bio,
        hasPassword: Boolean(me.password),
        // NEW: structured location fields for the settings page
        city: profile?.city ?? null,
        state: profile?.state ?? null,
        country: profile?.country ?? null,
        lat: profile?.lat ?? null,
        lng: profile?.lng ?? null,
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
            image: true,
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
    let shouldDeleteOldImage = false;

    // NEW: structured location fields
    let city: string | undefined;
    let state: string | undefined;
    let country: string | undefined;
    let lat: number | undefined;
    let lng: number | undefined;

    if (ct.includes("multipart/form-data")) {
        const form = await req.formData();
        name = String(form.get("name") ?? "") || undefined;
        location = String(form.get("location") ?? "") || undefined;
        bio = String(form.get("bio") ?? "") || undefined;

        // NEW: read structured fields from form
        city = (form.get("city") as string | null) || undefined;
        state = (form.get("state") as string | null) || undefined;
        country = (form.get("country") as string | null) || undefined;

        const latStr = (form.get("lat") as string | null) || "";
        const lngStr = (form.get("lng") as string | null) || "";
        const latNum = latStr ? Number(latStr) : NaN;
        const lngNum = lngStr ? Number(lngStr) : NaN;
        if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
            lat = latNum;
            lng = lngNum;
        }

        const file = form.get("image");
        if (file && file instanceof File && file.size > 0) {
            if (!file.type.startsWith("image/")) {
                return NextResponse.json({ message: "Invalid file type" }, { status: 400 });
            }
            if (file.size > 8 * 1024 * 1024) {
                return NextResponse.json({ message: "Image too large (8MB max)" }, { status: 400 });
            }

            try {
                const uploaded = await storeImageFile(file, {
                    folder: "avatars",
                    prefix: `avatar-${me.id}`,
                });
                newImageUrl = uploaded.url;
                if (me.image && me.image !== newImageUrl) {
                    shouldDeleteOldImage = true;
                }
            } catch (err: any) {
                const msg =
                    typeof err?.message === "string" && err.message.includes("Local uploads are not supported")
                        ? err.message
                        : "Failed to upload image";
                return NextResponse.json({ message: msg }, { status: 503 });
            }
        }
    } else {
        const body = await req.json().catch(() => ({}));
        name = body?.name || undefined;
        location = body?.location || undefined;
        bio = body?.bio || undefined;
        newImageUrl = body?.imageUrl || undefined;

        // NEW: structured fields from JSON (if you ever use JSON PATCH)
        city = body?.city || undefined;
        state = body?.state || undefined;
        country = body?.country || undefined;
        if (typeof body?.lat === "number" && typeof body?.lng === "number") {
            lat = body.lat;
            lng = body.lng;
        }
    }

    // Update base User fields
    await db.user.update({
        where: { id: me.id },
        data: {
            ...(name !== undefined ? { name } : {}),
            ...(location !== undefined ? { location } : {}),
            ...(newImageUrl ? { image: newImageUrl } : {}),
        },
    });

    if (shouldDeleteOldImage) {
        await deleteStoredFile(me.image);
    }

    // NEW: update city/state/country/lat/lng on the correct profile row
    const hasGeoUpdate =
        city !== undefined ||
        state !== undefined ||
        country !== undefined ||
        lat !== undefined ||
        lng !== undefined;

    if (hasGeoUpdate) {
        const geoData = {
            ...(city !== undefined ? { city } : {}),
            ...(state !== undefined ? { state } : {}),
            ...(country !== undefined ? { country } : {}),
            ...(lat !== undefined ? { lat } : {}),
            ...(lng !== undefined ? { lng } : {}),
        };

        if (me.role === "TRAINEE" && me.traineeProfile) {
            await db.traineeProfile.update({ where: { userId: me.id }, data: geoData });
        } else if (me.role === "TRAINER" && me.trainerProfile) {
            await db.trainerProfile.update({ where: { userId: me.id }, data: geoData });
        } else if (me.role === "GYM" && me.gymProfile) {
            await db.gymProfile.update({ where: { userId: me.id }, data: geoData });
        }
    }

    // Bio stays per-role as before
    if (bio !== undefined) {
        if (me.role === "TRAINEE" && me.traineeProfile) {
            await db.traineeProfile.update({ where: { userId: me.id }, data: { bio } });
        } else if (me.role === "TRAINER" && me.trainerProfile) {
            await db.trainerProfile.update({ where: { userId: me.id }, data: { bio } });
        } else if (me.role === "GYM" && me.gymProfile) {
            await db.gymProfile.update({ where: { userId: me.id }, data: { bio } });
        }
    }

    // Return fresh snapshot
    const out = await db.user.findUnique({
        where: { id: me.id },
        select: {
            id: true,
            name: true,
            username: true,
            image: true,
            location: true,
            role: true,
            traineeProfile: { select: { bio: true, city: true, state: true, country: true, lat: true, lng: true } },
            trainerProfile: { select: { bio: true, city: true, state: true, country: true, lat: true, lng: true } },
            gymProfile: { select: { bio: true, city: true, state: true, country: true, lat: true, lng: true } },
        },
    });

    const profile =
        out?.traineeProfile ??
        out?.trainerProfile ??
        out?.gymProfile ??
        null;

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
        city: profile?.city ?? null,
        state: profile?.state ?? null,
        country: profile?.country ?? null,
        lat: profile?.lat ?? null,
        lng: profile?.lng ?? null,
    });
}
