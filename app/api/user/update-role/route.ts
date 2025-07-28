import { NextResponse } from "@/node_modules/next/server"
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    let { role, selections, gymForm } = body;

    // Make sure the role is a valid Role enum value
    if (typeof role === "string") {
        role = role.toUpperCase();
    }
    if (!["TRAINEE", "TRAINER", "GYM"].includes(role)) {
        return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }

    try {
        const user = await db.user.update({
            where: { email: session.user.email },
            data: {
                role, // directly, as long as role is "TRAINEE", "TRAINER", or "GYM"
                ...(role === "TRAINEE" && {
                    traineeProfile: { create: { goals: selections } },
                }),
                ...(role === "TRAINER" && {
                    trainerProfile: { create: { services: selections } },
                }),
                ...(role === "GYM" && {
                    gymProfile: {
                        create: {
                            name: gymForm.name,
                            address: gymForm.address,
                            phone: gymForm.phone,
                            website: gymForm.website,
                            fee: gymForm.fee,
                        },
                    },
                }),
            },
        });

        return NextResponse.json({ user, message: "User updated" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: "Update failed" }, { status: 500 });
    }
}