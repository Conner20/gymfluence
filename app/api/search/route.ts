import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocoding";
import { db } from "@/prisma/client";

type Role = "TRAINEE" | "TRAINER" | "GYM";
type StatusFilter = "ALL" | "LOOKING_GYM" | "LOOKING_TRAINER" | "AT_GYM";
type SortBy = "DISTANCE" | "RATING";

const toNum = (v: string | null) => {
    if (v == null || v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sa =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
    return R * c;
}

async function backfillProfileCoordsFromSignupLocation(
    userId: string,
    role: Role | null,
    location: string | null
) {
    if (!role || !location?.trim()) return null;

    const geocoded = await geocodeAddress(location);
    if (!geocoded) return null;

    const geoData = {
        city: geocoded.city,
        state: geocoded.state,
        country: geocoded.country,
        lat: geocoded.lat,
        lng: geocoded.lng,
    };

    if (role === "TRAINEE") {
        await db.traineeProfile.update({
            where: { userId },
            data: geoData,
        });
    } else if (role === "TRAINER") {
        await db.trainerProfile.update({
            where: { userId },
            data: geoData,
        });
    } else if (role === "GYM") {
        await db.gymProfile.update({
            where: { userId },
            data: geoData,
        });
    }

    return geoData;
}

export async function GET(req: Request) {
    const url = new URL(req.url);

    const q = url.searchParams.get("q")?.trim() ?? "";
    const roleParam = (url.searchParams.get("role") || "ALL").toUpperCase() as "ALL" | Role;
    const statusParam = (url.searchParams.get("status") || url.searchParams.get("seeking") || "ALL").toUpperCase() as StatusFilter;
    const sortBy = (url.searchParams.get("sortBy") || "DISTANCE").toUpperCase() as SortBy;
    const hiringOnly = url.searchParams.get("hiringOnly") === "true";

    // IMPORTANT: only treat as active if the param exists and is non-empty
    const hasMin = url.searchParams.has("minBudget") && url.searchParams.get("minBudget")!.trim() !== "";
    const hasMax = url.searchParams.has("maxBudget") && url.searchParams.get("maxBudget")!.trim() !== "";
    const minBudget = hasMin ? toNum(url.searchParams.get("minBudget")) : null;
    const maxBudget = hasMax ? toNum(url.searchParams.get("maxBudget")) : null;

    const goalsParam = url.searchParams.get("goals") || "";
    const goals = goalsParam.split(",").map((s) => s.trim()).filter(Boolean);

    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(Math.max(5, Number(url.searchParams.get("pageSize") || 50)), 1000);
    const viewerLatParam = toNum(url.searchParams.get("viewerLat"));
    const viewerLngParam = toNum(url.searchParams.get("viewerLng"));

    const session = await getServerSession(authOptions);

    // viewer id (hide self + apply private-follow rule)
    let viewerId: string | null = null;
    if (session?.user?.email) {
        const me = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        viewerId = me?.id ?? null;
    }

    // viewer coords (optional)
    let viewerLat: number | null = null;
    let viewerLng: number | null = null;

    if (viewerId) {
        const me = await db.user.findUnique({
            where: { id: viewerId },
            select: {
                role: true,
                location: true,
                traineeProfile: { select: { lat: true, lng: true } },
                trainerProfile: { select: { lat: true, lng: true } },
                gymProfile: { select: { lat: true, lng: true } },
            },
        });
        const p = me?.traineeProfile || me?.trainerProfile || me?.gymProfile || null;
        if (p?.lat != null && p?.lng != null) {
            viewerLat = p.lat;
            viewerLng = p.lng;
        } else if (me?.location?.trim() && me.role) {
            try {
                const geocoded = await backfillProfileCoordsFromSignupLocation(viewerId, me.role, me.location);
                if (geocoded) {
                    viewerLat = geocoded.lat;
                    viewerLng = geocoded.lng;
                }
            } catch {
                // fall through to browser coordinates when stored signup location cannot be backfilled
            }
        }
    }

    if ((viewerLat == null || viewerLng == null) && viewerLatParam != null && viewerLngParam != null) {
        viewerLat = viewerLatParam;
        viewerLng = viewerLngParam;
    }

    // ----- build Prisma where -----
    const AND: any[] = [];

    // name / username contains
    if (q) {
        AND.push({
            OR: [
                { username: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
            ],
        });
    }

    // privacy: allow public, or private only if follower (accepted)
    AND.push(
        viewerId
            ? {
                OR: [
                    { isPrivate: false },
                    {
                        isPrivate: true,
                        followers: { some: { followerId: viewerId, status: "ACCEPTED" } },
                    },
                ],
            }
            : { isPrivate: false }
    );

    // exclude myself
    if (viewerId) AND.push({ NOT: { id: viewerId } });

    // explicit role filter (only when role is not ALL)
    if (roleParam !== "ALL") {
        AND.push({ role: roleParam });
    }

    // goal filters (map to the right profile field per role)
    if (goals.length) {
        if (roleParam === "TRAINEE") {
            AND.push({ traineeProfile: { goals: { hasEvery: goals } } });
        } else if (roleParam === "TRAINER") {
            AND.push({ trainerProfile: { services: { hasEvery: goals } } });
        } else {
            // ALL: allow either trainee goals or trainer services to match
            AND.push({
                OR: [
                    { role: "TRAINEE", traineeProfile: { goals: { hasEvery: goals } } },
                    { role: "TRAINER", trainerProfile: { services: { hasEvery: goals } } },
                ],
            });
        }
    }

    // budget filters — ONLY if user actually set min or max
    if (hasMin || hasMax) {
        const priceCond = {
            gte: hasMin ? minBudget! : undefined,
            lte: hasMax ? maxBudget! : undefined,
        };

        if (roleParam === "TRAINER") {
            AND.push({
                OR: [
                    { trainerProfile: { hourlyRate: priceCond } },
                    { trainerProfile: { hourlyRate: null } },
                ],
            });
        } else if (roleParam === "GYM") {
            AND.push({ gymProfile: { fee: priceCond } });
        } else {
            // ALL: price can apply to trainer or gym
            AND.push({
                OR: [
                    { role: "TRAINER", trainerProfile: { hourlyRate: priceCond } },
                    { role: "TRAINER", trainerProfile: { hourlyRate: null } },
                    { role: "GYM", gymProfile: { fee: priceCond } },
                ],
            });
        }
    }

    if (roleParam === "GYM" && hiringOnly) {
        AND.push({ gymProfile: { hiringTrainers: true } });
    }

    const where: any = AND.length ? { AND } : {};
    // NOTE: We DO NOT add any role OR when role=ALL.
    // That keeps users with role=null included (so you truly see everyone you’re allowed to).

    // ----- query -----
    const raw = await db.user.findMany({
        where,
        take: 3000,
        orderBy: { username: "asc" },
        select: {
            id: true,
            username: true,
            name: true,
            image: true,
            role: true,
            isPrivate: true,
            location: true,
            bio: true,
            traineeProfile: {
                select: {
                    goals: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                    gymStatus: true,
                    trainerStatus: true,
                },
            },
            trainerProfile: {
                select: {
                    services: true,
                    hourlyRate: true,
                    rating: true,
                    clients: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                    gymStatus: true,
                },
            },
            gymProfile: {
                select: {
                    name: true,
                    fee: true,
                    rating: true,
                    hiringTrainers: true,
                    amenities: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                },
            },
            searchGalleryImages: {
                select: { url: true },
                orderBy: { createdAt: "desc" },
                take: 18,
            },
        },
    });

    const haveViewerPoint = viewerLat != null && viewerLng != null;

    const statusFilteredRaw = raw.filter((u: typeof raw[number]) => {
        if (statusParam === "ALL") return true;

        const lookingForGym =
            (u.role === "TRAINEE" && u.traineeProfile?.gymStatus === "LOOKING") ||
            (u.role === "TRAINER" && u.trainerProfile?.gymStatus === "LOOKING");

        const lookingForTrainer =
            (u.role === "TRAINEE" && u.traineeProfile?.trainerStatus === "LOOKING") ||
            (u.role === "GYM" && u.gymProfile?.hiringTrainers === true);

        const trainingAtGym =
            (u.role === "TRAINEE" && u.traineeProfile?.gymStatus === "MEMBER") ||
            (u.role === "TRAINER" && u.trainerProfile?.gymStatus === "TRAINER");

        if (statusParam === "LOOKING_GYM") return lookingForGym;
        if (statusParam === "LOOKING_TRAINER") return lookingForTrainer;
        if (statusParam === "AT_GYM") return trainingAtGym;
        return true;
    });

    // Build result objects and backfill signup-based coordinates when needed
    const processed = await Promise.all(
        statusFilteredRaw.map(async (u: typeof raw[number]) => {
            let p = u.traineeProfile || u.trainerProfile || u.gymProfile || ({} as any);

            if ((p.lat == null || p.lng == null) && u.role && u.location?.trim()) {
                try {
                    const geocoded = await backfillProfileCoordsFromSignupLocation(u.id, u.role, u.location);
                    if (geocoded) {
                        p = { ...p, ...geocoded };
                    }
                } catch {
                    // leave this user as unknown-distance if backfill fails
                }
            }

            const lat: number | undefined = p.lat ?? undefined;
            const lng: number | undefined = p.lng ?? undefined;

            let distance: number | null = null;
            if (haveViewerPoint && lat != null && lng != null) {
                distance = haversineKm({ lat: viewerLat!, lng: viewerLng! }, { lat, lng });
            }

            const price =
                u.role === "TRAINER"
                    ? u.trainerProfile?.hourlyRate ?? null
                    : u.role === "GYM"
                        ? u.gymProfile?.fee ?? null
                        : null;

            return {
                id: u.id,
                username: u.username,
                name: u.role === "GYM" ? u.gymProfile?.name ?? u.name : u.name,
                image: u.image,
                role: u.role,
                isPrivate: u.isPrivate,
                location: u.location,
                price,
                city: p.city || null,
                state: p.state || null,
                country: p.country || null,
                goals: u.traineeProfile?.goals ?? null,
                services: u.trainerProfile?.services ?? null,
                rating: u.role === "GYM" ? u.gymProfile?.rating ?? null : u.trainerProfile?.rating ?? null,
                clients: u.trainerProfile?.clients ?? null,
                amenities: u.gymProfile?.amenities ?? null,
                amenitiesText: u.gymProfile?.amenities?.[0] ?? null,
                hiringTrainers: u.gymProfile?.hiringTrainers ?? false,
                distanceKm: distance,
                about: u.bio ?? null,
                gallery:
                    u.searchGalleryImages?.map(
                        (img: typeof u.searchGalleryImages[number]) => img.url
                    ) ?? [],
            };
        })
    );

    // rating sort overrides budget sort; budget sort overrides default distance sort
    processed.sort((a: typeof processed[number], b: typeof processed[number]) => {
        if ((roleParam === "GYM" || roleParam === "TRAINER") && sortBy === "RATING") {
            if (a.rating != null && b.rating != null && a.rating !== b.rating) return b.rating - a.rating;
            if (a.rating != null && b.rating == null) return -1;
            if (a.rating == null && b.rating != null) return 1;
        }

        if (hasMin || hasMax) {
            if (a.price != null && b.price != null && a.price !== b.price) return a.price - b.price;
            if (a.price != null && b.price == null) return -1;
            if (a.price == null && b.price != null) return 1;
        }

        if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm != null) return -1;
        if (b.distanceKm != null) return 1;

        if (hasMin || hasMax) {
            if (a.price != null && b.price != null) return a.price - b.price;
        }

        const an = (a.username || a.name || "").toLowerCase();
        const bn = (b.username || b.name || "").toLowerCase();
        return an.localeCompare(bn);
    });

    const total = processed.length;
    const start = (page - 1) * pageSize;
    const pageItems = processed.slice(start, start + pageSize);

    return NextResponse.json({
        page,
        pageSize,
        total,
        results: pageItems,
        viewerHasCoords: haveViewerPoint,
    });
}
