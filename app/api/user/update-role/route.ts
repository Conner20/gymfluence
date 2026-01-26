// app/api/user/update-role/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        let { role, selections = [], gymForm } = body;

        const identifier = session.user.email.toLowerCase();

        // normalize and validate role
        if (typeof role === "string") role = role.toUpperCase();
        if (!["TRAINEE", "TRAINER", "GYM"].includes(role)) {
            return NextResponse.json({ message: "Invalid role" }, { status: 400 });
        }

        // find current user (by email from session)
        const current = await db.user.findFirst({
            where: { email: { equals: identifier, mode: "insensitive" } },
            select: { id: true },
        });
        if (!current) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const data: any = { role };

        if (role === "TRAINEE") {
            if (!Array.isArray(selections)) selections = [];
            data.traineeProfile = {
                upsert: {
                    update: { goals: selections },
                    // ❌ do NOT include userId in nested create
                    create: { goals: selections },
                },
            };
        }

        if (role === "TRAINER") {
            if (!Array.isArray(selections)) selections = [];
            data.trainerProfile = {
                upsert: {
                    update: { services: selections },
                    // ❌ do NOT include userId in nested create
                    create: { services: selections },
                },
            };
        }

        if (role === "GYM") {
            if (!gymForm) {
                return NextResponse.json({ message: "Missing gym form" }, { status: 400 });
            }

            // Ensure fee is a number (schema uses Float)
            const feeNum = Number(gymForm.fee);
            if (Number.isNaN(feeNum)) {
                return NextResponse.json({ message: "Fee must be a number" }, { status: 400 });
            }

            data.gymProfile = {
                upsert: {
                    update: {
                        name: gymForm.name,
                        address: gymForm.address,
                        phone: gymForm.phone,
                        website: gymForm.website,
                        fee: feeNum,
                    },
                    create: {
                        name: gymForm.name,
                        address: gymForm.address,
                        phone: gymForm.phone,
                        website: gymForm.website,
                        fee: feeNum,
                    },
                },
            };
        }

        const user = await db.user.update({
            where: { id: current.id },
            data,
            include: {
                traineeProfile: true,
                trainerProfile: true,
                gymProfile: true,
            },
        });

        return NextResponse.json({ user, message: "User updated" });
    } catch (err: any) {
        console.error("update-role error:", err);
        // surface a useful message if possible
        return NextResponse.json(
            { message: err?.message || "Update failed" },
            { status: 500 }
        );
    }
}
