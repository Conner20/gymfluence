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
                select: {
                    bio: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                    trainerStatus: true,
                    gymStatus: true,
                    gymName: true,
                    gymPlaceId: true,
                    associatedTrainer: {
                        select: { id: true, username: true, name: true },
                    },
                },
            },
            trainerProfile: {
                select: {
                    bio: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                    website: true,
                    showWebsiteButton: true,
                    gymStatus: true,
                    gymName: true,
                    gymPlaceId: true,
                },
            },
            gymProfile: {
                select: {
                    bio: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                    website: true,
                    showWebsiteButton: true,
                    hiringTrainers: true,
                },
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
        website: me.gymProfile?.website ?? me.trainerProfile?.website ?? null,
        showWebsiteButton: me.gymProfile?.showWebsiteButton ?? me.trainerProfile?.showWebsiteButton ?? false,
        hiringTrainers: me.gymProfile?.hiringTrainers ?? false,
        traineeTrainerStatus: me.traineeProfile?.trainerStatus ?? null,
        traineeGymStatus: me.traineeProfile?.gymStatus ?? null,
        traineeGymName: me.traineeProfile?.gymName ?? null,
        traineeGymPlaceId: me.traineeProfile?.gymPlaceId ?? null,
        associatedTrainer: me.traineeProfile?.associatedTrainer ?? null,
        trainerGymStatus: me.trainerProfile?.gymStatus ?? null,
        trainerGymName: me.trainerProfile?.gymName ?? null,
        trainerGymPlaceId: me.trainerProfile?.gymPlaceId ?? null,
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
    let website: string | undefined;
    let showWebsiteButton: boolean | undefined;
    let hiringTrainers: boolean | undefined;
    let traineeTrainerStatus: "LOOKING" | "TRAINING_WITH" | null | undefined;
    let traineeGymStatus: "LOOKING" | "MEMBER" | null | undefined;
    let trainerGymStatus: "LOOKING" | "TRAINER" | null | undefined;
    let associatedTrainerId: string | null | undefined;
    let associatedGymName: string | null | undefined;
    let associatedGymPlaceId: string | null | undefined;

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
        const websiteValue = form.get("website");
        const showWebsiteButtonValue = form.get("showWebsiteButton");
        const hiringTrainersValue = form.get("hiringTrainers");
        const latNum = latStr ? Number(latStr) : NaN;
        const lngNum = lngStr ? Number(lngStr) : NaN;
        if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
            lat = latNum;
            lng = lngNum;
        }
        if (websiteValue !== null) {
            website = String(websiteValue).trim() || "";
        }
        if (showWebsiteButtonValue !== null) {
            showWebsiteButton = String(showWebsiteButtonValue) === "true";
        }
        if (hiringTrainersValue !== null) {
            hiringTrainers = String(hiringTrainersValue) === "true";
        }
        const traineeTrainerStatusValue = form.get("traineeTrainerStatus");
        const traineeGymStatusValue = form.get("traineeGymStatus");
        const trainerGymStatusValue = form.get("trainerGymStatus");
        const associatedTrainerIdValue = form.get("associatedTrainerId");
        const associatedGymNameValue = form.get("associatedGymName");
        const associatedGymPlaceIdValue = form.get("associatedGymPlaceId");

        if (traineeTrainerStatusValue !== null) {
            const value = String(traineeTrainerStatusValue) || "";
            traineeTrainerStatus = value === "LOOKING" || value === "TRAINING_WITH" ? value : null;
        }
        if (traineeGymStatusValue !== null) {
            const value = String(traineeGymStatusValue) || "";
            traineeGymStatus = value === "LOOKING" || value === "MEMBER" ? value : null;
        }
        if (trainerGymStatusValue !== null) {
            const value = String(trainerGymStatusValue) || "";
            trainerGymStatus = value === "LOOKING" || value === "TRAINER" ? value : null;
        }
        if (associatedTrainerIdValue !== null) {
            associatedTrainerId = String(associatedTrainerIdValue) || null;
        }
        if (associatedGymNameValue !== null) {
            associatedGymName = String(associatedGymNameValue) || null;
        }
        if (associatedGymPlaceIdValue !== null) {
            associatedGymPlaceId = String(associatedGymPlaceIdValue) || null;
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
        if (typeof body?.showWebsiteButton === "boolean") {
            showWebsiteButton = body.showWebsiteButton;
        }
        if (typeof body?.hiringTrainers === "boolean") {
            hiringTrainers = body.hiringTrainers;
        }
        if ("website" in body) {
            website = String(body?.website ?? "").trim();
        }
        if ("traineeTrainerStatus" in body) {
            traineeTrainerStatus =
                body?.traineeTrainerStatus === "LOOKING" || body?.traineeTrainerStatus === "TRAINING_WITH"
                    ? body.traineeTrainerStatus
                    : null;
        }
        if ("traineeGymStatus" in body) {
            traineeGymStatus =
                body?.traineeGymStatus === "LOOKING" || body?.traineeGymStatus === "MEMBER"
                    ? body.traineeGymStatus
                    : null;
        }
        if ("trainerGymStatus" in body) {
            trainerGymStatus =
                body?.trainerGymStatus === "LOOKING" || body?.trainerGymStatus === "TRAINER"
                    ? body.trainerGymStatus
                    : null;
        }
        if ("associatedTrainerId" in body) {
            associatedTrainerId = body?.associatedTrainerId || null;
        }
        if ("associatedGymName" in body) {
            associatedGymName = body?.associatedGymName || null;
        }
        if ("associatedGymPlaceId" in body) {
            associatedGymPlaceId = body?.associatedGymPlaceId || null;
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
        lng !== undefined ||
        website !== undefined ||
        showWebsiteButton !== undefined ||
        hiringTrainers !== undefined ||
        traineeTrainerStatus !== undefined ||
        traineeGymStatus !== undefined ||
        trainerGymStatus !== undefined ||
        associatedTrainerId !== undefined ||
        associatedGymName !== undefined ||
        associatedGymPlaceId !== undefined;

    if (hasGeoUpdate) {
        let validatedAssociatedTrainerId = associatedTrainerId;

        if (me.role === "TRAINEE" && traineeTrainerStatus === "TRAINING_WITH") {
            if (!associatedTrainerId) {
                return NextResponse.json(
                    { message: "Please select a trainer." },
                    { status: 400 }
                );
            }

            const associatedTrainer = await db.user.findUnique({
                where: { id: associatedTrainerId },
                select: { id: true, role: true },
            });

            if (!associatedTrainer || associatedTrainer.role !== "TRAINER") {
                return NextResponse.json(
                    { message: "Selected trainer was not found." },
                    { status: 400 }
                );
            }

            validatedAssociatedTrainerId = associatedTrainer.id;
        }

        const geoData = {
            ...(city !== undefined ? { city } : {}),
            ...(state !== undefined ? { state } : {}),
            ...(country !== undefined ? { country } : {}),
            ...(lat !== undefined ? { lat } : {}),
            ...(lng !== undefined ? { lng } : {}),
            ...(website !== undefined ? { website } : {}),
            ...(showWebsiteButton !== undefined ? { showWebsiteButton } : {}),
            ...(hiringTrainers !== undefined ? { hiringTrainers } : {}),
        };

        if (me.role === "TRAINEE" && me.traineeProfile) {
            await db.traineeProfile.update({
                where: { userId: me.id },
                data: {
                    ...geoData,
                    ...(traineeTrainerStatus !== undefined ? { trainerStatus: traineeTrainerStatus } : {}),
                    ...(traineeGymStatus !== undefined ? { gymStatus: traineeGymStatus } : {}),
                    ...(associatedTrainerId !== undefined
                        ? {
                            associatedTrainerId:
                                traineeTrainerStatus === "TRAINING_WITH"
                                    ? validatedAssociatedTrainerId
                                    : null,
                        }
                        : {}),
                    ...(associatedGymName !== undefined
                        ? { gymName: traineeGymStatus === "MEMBER" ? associatedGymName : null }
                        : {}),
                    ...(associatedGymPlaceId !== undefined
                        ? { gymPlaceId: traineeGymStatus === "MEMBER" ? associatedGymPlaceId : null }
                        : {}),
                },
            });
        } else if (me.role === "TRAINER" && me.trainerProfile) {
            await db.trainerProfile.update({
                where: { userId: me.id },
                data: {
                    ...geoData,
                    ...(trainerGymStatus !== undefined ? { gymStatus: trainerGymStatus } : {}),
                    ...(associatedGymName !== undefined
                        ? { gymName: trainerGymStatus === "TRAINER" ? associatedGymName : null }
                        : {}),
                    ...(associatedGymPlaceId !== undefined
                        ? { gymPlaceId: trainerGymStatus === "TRAINER" ? associatedGymPlaceId : null }
                        : {}),
                },
            });
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
            traineeProfile: {
                select: {
                    bio: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                    trainerStatus: true,
                    gymStatus: true,
                    gymName: true,
                    gymPlaceId: true,
                    associatedTrainer: {
                        select: { id: true, username: true, name: true },
                    },
                },
            },
            trainerProfile: {
                select: {
                    bio: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                    website: true,
                    showWebsiteButton: true,
                    gymStatus: true,
                    gymName: true,
                    gymPlaceId: true,
                },
            },
            gymProfile: {
                select: {
                    bio: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                    website: true,
                    showWebsiteButton: true,
                    hiringTrainers: true,
                },
            },
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
        website: out?.gymProfile?.website ?? out?.trainerProfile?.website ?? null,
        showWebsiteButton: out?.gymProfile?.showWebsiteButton ?? out?.trainerProfile?.showWebsiteButton ?? false,
        hiringTrainers: out?.gymProfile?.hiringTrainers ?? false,
        traineeTrainerStatus: out?.traineeProfile?.trainerStatus ?? null,
        traineeGymStatus: out?.traineeProfile?.gymStatus ?? null,
        traineeGymName: out?.traineeProfile?.gymName ?? null,
        traineeGymPlaceId: out?.traineeProfile?.gymPlaceId ?? null,
        associatedTrainer: out?.traineeProfile?.associatedTrainer ?? null,
        trainerGymStatus: out?.trainerProfile?.gymStatus ?? null,
        trainerGymName: out?.trainerProfile?.gymName ?? null,
        trainerGymPlaceId: out?.trainerProfile?.gymPlaceId ?? null,
    });
}
