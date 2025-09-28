import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

type Role = "TRAINEE" | "TRAINER" | "GYM";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const me = await db.user.findUnique({
            where: { email: session.user.email },
            select: {
                id: true,
                role: true,
                bio: true,
                username: true,
                name: true,
                traineeProfile: { select: { goals: true } },
                trainerProfile: { select: { services: true, hourlyRate: true } },
                gymProfile: {
                    select: {
                        name: true,
                        fee: true,
                        amenities: true,
                        address: true,
                        phone: true,
                        website: true,
                    },
                },
            },
        });

        if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const payload: any = {
            role: me.role,
            about: me.bio ?? "",
        };

        if (me.role === "TRAINEE") {
            payload.goals = me.traineeProfile?.goals ?? [];
        } else if (me.role === "TRAINER") {
            payload.services = me.trainerProfile?.services ?? [];
            payload.hourlyRate = me.trainerProfile?.hourlyRate ?? null;
        } else if (me.role === "GYM") {
            payload.gymFee = me.gymProfile?.fee ?? null;
            payload.amenitiesText = me.gymProfile?.amenities?.[0] ?? "";
            payload.gymName = me.gymProfile?.name ?? me.name ?? me.username ?? "Gym";
            payload.gymAddress = me.gymProfile?.address ?? "";
            payload.gymPhone = me.gymProfile?.phone ?? "";
            payload.gymWebsite = me.gymProfile?.website ?? "";
        }

        return NextResponse.json(payload);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const me = await db.user.findUnique({
            where: { email: session.user.email },
            select: {
                id: true,
                role: true,
                username: true,
                name: true,
                bio: true,
                traineeProfile: { select: { goals: true } },
                trainerProfile: { select: { services: true, hourlyRate: true } },
                gymProfile: {
                    select: {
                        name: true,
                        fee: true,
                        amenities: true,
                        address: true,
                        phone: true,
                        website: true,
                    },
                },
            },
        });

        if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json().catch(() => ({} as any));

        const {
            about,
            goals,
            services,
            hourlyRate,
            gymFee,
            amenitiesText,
            gymName,
            gymAddress,
            gymPhone,
            gymWebsite,
        }: {
            about?: string;
            goals?: string[];
            services?: string[];
            hourlyRate?: number | null;
            gymFee?: number | null;
            amenitiesText?: string;
            gymName?: string;
            gymAddress?: string;
            gymPhone?: string;
            gymWebsite?: string;
        } = body ?? {};

        // Bio update is independent of role
        if (typeof about === "string") {
            await db.user.update({
                where: { id: me.id },
                data: { bio: about },
            });
        }

        if (me.role === "TRAINEE") {
            if (Array.isArray(goals)) {
                await db.traineeProfile.upsert({
                    where: { userId: me.id },
                    create: { userId: me.id, goals },
                    update: { goals },
                });
            }
        } else if (me.role === "TRAINER") {
            const servicesData = Array.isArray(services) ? services : undefined;
            const hourlyRateData =
                hourlyRate === null || typeof hourlyRate === "number"
                    ? hourlyRate
                    : undefined;

            if (servicesData !== undefined || hourlyRateData !== undefined) {
                await db.trainerProfile.upsert({
                    where: { userId: me.id },
                    create: {
                        userId: me.id,
                        services: servicesData ?? [],
                        hourlyRate: hourlyRateData ?? null,
                    },
                    update: {
                        ...(servicesData !== undefined ? { services: servicesData } : {}),
                        ...(hourlyRateData !== undefined ? { hourlyRate: hourlyRateData } : {}),
                    },
                });
            }
        } else if (me.role === "GYM") {
            // --- Derive type-safe values for required fields and updates ---
            const nameValue: string =
                (typeof gymName === "string" && gymName.trim()) ||
                me.gymProfile?.name ||
                me.name ||
                me.username ||
                "Gym";

            const addressValue: string =
                (typeof gymAddress === "string" && gymAddress) ||
                me.gymProfile?.address ||
                "";

            const phoneValue: string =
                (typeof gymPhone === "string" && gymPhone) ||
                me.gymProfile?.phone ||
                "";

            const websiteValue: string =
                (typeof gymWebsite === "string" && gymWebsite) ||
                me.gymProfile?.website ||
                "";

            const feeValue: number =
                typeof gymFee === "number"
                    ? gymFee
                    : typeof me.gymProfile?.fee === "number"
                        ? me.gymProfile.fee
                        : 0;

            const amenitiesArray: string[] =
                typeof amenitiesText === "string" ? [amenitiesText] : me.gymProfile?.amenities ?? [];

            // --- Upsert with all required create fields present ---
            await db.gymProfile.upsert({
                where: { userId: me.id },
                create: {
                    userId: me.id,
                    name: nameValue,
                    address: addressValue,
                    phone: phoneValue,
                    website: websiteValue,
                    fee: feeValue,
                    amenities: amenitiesArray,
                },
                update: {
                    ...(typeof gymName === "string" && gymName.trim() ? { name: gymName.trim() } : {}),
                    ...(typeof gymAddress === "string" ? { address: gymAddress } : {}),
                    ...(typeof gymPhone === "string" ? { phone: gymPhone } : {}),
                    ...(typeof gymWebsite === "string" ? { website: gymWebsite } : {}),
                    ...(typeof gymFee === "number" || gymFee === null ? { fee: feeValue } : {}),
                    ...(typeof amenitiesText === "string" ? { amenities: [amenitiesText] } : {}),
                },
            });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
}
