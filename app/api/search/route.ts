import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

// helpers (same as before)
const toNum = (v: string | null, d: number) => {
    if (v === null || v === "") return d;
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
};

type Role = "TRAINEE" | "TRAINER" | "GYM";

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

export async function GET(req: Request) {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const roleParam = (url.searchParams.get("role") || "ALL").toUpperCase();
    const roles: Role[] =
        roleParam === "ALL" ? ["TRAINEE", "TRAINER", "GYM"] : ([(roleParam as Role)] as Role[]);

    const minBudget = toNum(url.searchParams.get("minBudget"), 0);
    const maxBudget = toNum(url.searchParams.get("maxBudget"), Number.POSITIVE_INFINITY);
    const distanceKm = toNum(url.searchParams.get("distanceKm"), 0);
    const goalsParam = url.searchParams.get("goals") || "";
    const goals = goalsParam.split(",").map((s) => s.trim()).filter(Boolean);

    const page = Math.max(1, toNum(url.searchParams.get("page"), 1));
    const pageSize = Math.min(Math.max(5, toNum(url.searchParams.get("pageSize"), 10)), 200);

    const session = await getServerSession(authOptions);

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
    let viewerCity: string | null = null;

    if (viewerId) {
        const me = await db.user.findUnique({
            where: { id: viewerId },
            select: {
                location: true,
                traineeProfile: { select: { lat: true, lng: true, city: true } },
                trainerProfile: { select: { lat: true, lng: true, city: true } },
                gymProfile: { select: { lat: true, lng: true, city: true } },
            },
        });
        const p = me?.traineeProfile || me?.trainerProfile || me?.gymProfile || null;
        if (p?.lat != null && p?.lng != null) {
            viewerLat = p.lat;
            viewerLng = p.lng;
        }
        viewerCity = p?.city || (me?.location ?? null);
    }

    // text filter
    const baseName: any = q
        ? {
            OR: [
                { username: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
            ],
        }
        : {};

    // role blocks (+ goals/services + budget)
    const roleBlocks = roles.map((r) => {
        const block: any = { role: r };
        if (goals.length) {
            if (r === "TRAINEE") block.traineeProfile = { goals: { hasSome: goals } };
            if (r === "TRAINER")
                block.trainerProfile = { ...(block.trainerProfile || {}), services: { hasSome: goals } };
        }
        if (Number.isFinite(minBudget) || Number.isFinite(maxBudget)) {
            if (r === "TRAINER") {
                block.trainerProfile = {
                    ...(block.trainerProfile || {}),
                    hourlyRate: {
                        gte: Number.isFinite(minBudget) ? minBudget : undefined,
                        lte: Number.isFinite(maxBudget) ? maxBudget : undefined,
                    },
                };
            }
            if (r === "GYM") {
                block.gymProfile = {
                    ...(block.gymProfile || {}),
                    fee: {
                        gte: Number.isFinite(minBudget) ? minBudget : undefined,
                        lte: Number.isFinite(maxBudget) ? maxBudget : undefined,
                    },
                };
            }
        }
        return block;
    });

    // PRIVACY: public OR (private AND followed by viewer with ACCEPTED)
    const privacyWhere: any = viewerId
        ? {
            OR: [
                { isPrivate: false },
                {
                    isPrivate: true,
                    followers: { some: { followerId: viewerId, status: "ACCEPTED" } },
                },
            ],
        }
        : { isPrivate: false };

    // EXCLUDE SELF when signed in
    const notSelf = viewerId ? { NOT: { id: viewerId } } : {};

    const where: any = {
        AND: [baseName, privacyWhere, notSelf],
        ...(roleBlocks.length ? { OR: roleBlocks } : {}),
    };

    const raw = await db.user.findMany({
        where,
        take: 500,
        orderBy: { username: "asc" },
        select: {
            id: true,
            username: true,
            name: true,
            image: true,
            role: true,
            isPrivate: true,
            location: true,
            bio: true, // <-- NEW: include user bio
            traineeProfile: {
                select: { goals: true, city: true, state: true, country: true, lat: true, lng: true },
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
                },
            },
            gymProfile: {
                select: {
                    fee: true,
                    amenities: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                },
            },
        },
    });

    const haveViewerPoint = viewerLat != null && viewerLng != null;

    const processed = raw
        .map((u) => {
            const p = u.traineeProfile || u.trainerProfile || u.gymProfile || ({} as any);
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

            const city = p.city || null;
            const state = p.state || null;
            const country = p.country || null;

            return {
                id: u.id,
                username: u.username,
                name: u.name,
                image: u.image,
                role: u.role,
                isPrivate: u.isPrivate,
                location: u.location,
                price,
                city,
                state,
                country,
                goals: u.traineeProfile?.goals ?? null,
                services: u.trainerProfile?.services ?? null,
                rating: u.trainerProfile?.rating ?? null,
                clients: u.trainerProfile?.clients ?? null,
                amenities: u.gymProfile?.amenities ?? null,
                distanceKm: distance,
                about: u.bio ?? null, // <-- surface user bio as description
            };
        })
        .filter((r) => {
            if (distanceKm > 0) {
                if (r.distanceKm != null) return r.distanceKm <= distanceKm;
                if (viewerCity && r.city) return viewerCity.toLowerCase() === r.city.toLowerCase();
                return false;
            }
            return true;
        });

    processed.sort((a, b) => {
        if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm != null) return -1;
        if (b.distanceKm != null) return 1;
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
