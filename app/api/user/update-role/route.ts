// app/api/user/update-role/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import { encode } from "next-auth/jwt";
import { geocodeAddress } from "@/lib/geocoding";

async function getIdentifierFromOnboardingCookie() {
    const cookieStore = await cookies();
    const token = cookieStore.get("onboarding_token")?.value;
    if (!token) return null;
    try {
        const secret = new TextEncoder().encode(env.NEXTAUTH_SECRET);
        const { payload } = await jwtVerify(token, secret);
        if (typeof payload?.email === "string" && payload.email.length > 0) {
            return payload.email;
        }
        return null;
    } catch (err) {
        console.error("onboarding token verification failed:", err);
        return null;
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    let identifier = session?.user?.email ?? null;

    if (!identifier) {
        identifier = await getIdentifierFromOnboardingCookie();
    }

    if (!identifier) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        let { role, selections = [], gymForm } = body;

        identifier = identifier.toLowerCase();

        // normalize and validate role
        if (typeof role === "string") role = role.toUpperCase();
        if (!["TRAINEE", "TRAINER", "GYM"].includes(role)) {
            return NextResponse.json({ message: "Invalid role" }, { status: 400 });
        }

        // find current user (by email from session)
        const current = await db.user.findFirst({
            where: { email: { equals: identifier, mode: "insensitive" } },
            select: { id: true, location: true },
        });
        if (!current) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const data: any = { role, lastLoginAt: new Date() };
        let signupLocationGeo = null;
        if ((role === "TRAINEE" || role === "TRAINER") && current.location?.trim()) {
            try {
                signupLocationGeo = await geocodeAddress(current.location);
            } catch (error) {
                console.error("signup location geocode failed during onboarding:", error);
            }
        }

        if (role === "TRAINEE") {
            if (!Array.isArray(selections)) selections = [];
            data.traineeProfile = {
                upsert: {
                    update: {
                        goals: selections,
                        ...(signupLocationGeo
                            ? {
                                  city: signupLocationGeo.city,
                                  state: signupLocationGeo.state,
                                  country: signupLocationGeo.country,
                                  lat: signupLocationGeo.lat,
                                  lng: signupLocationGeo.lng,
                              }
                            : {}),
                    },
                    // ❌ do NOT include userId in nested create
                    create: {
                        goals: selections,
                        ...(signupLocationGeo
                            ? {
                                  city: signupLocationGeo.city,
                                  state: signupLocationGeo.state,
                                  country: signupLocationGeo.country,
                                  lat: signupLocationGeo.lat,
                                  lng: signupLocationGeo.lng,
                              }
                            : {}),
                    },
                },
            };
        }

        if (role === "TRAINER") {
            if (!Array.isArray(selections)) selections = [];
            data.trainerProfile = {
                upsert: {
                    update: {
                        services: selections,
                        ...(signupLocationGeo
                            ? {
                                  city: signupLocationGeo.city,
                                  state: signupLocationGeo.state,
                                  country: signupLocationGeo.country,
                                  lat: signupLocationGeo.lat,
                                  lng: signupLocationGeo.lng,
                              }
                            : {}),
                    },
                    // ❌ do NOT include userId in nested create
                    create: {
                        services: selections,
                        ...(signupLocationGeo
                            ? {
                                  city: signupLocationGeo.city,
                                  state: signupLocationGeo.state,
                                  country: signupLocationGeo.country,
                                  lat: signupLocationGeo.lat,
                                  lng: signupLocationGeo.lng,
                              }
                            : {}),
                    },
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

            let geocoded = null;
            try {
                geocoded = await geocodeAddress(gymForm.address);
            } catch (error) {
                console.error("gym onboarding geocode failed:", error);
            }

            data.name = gymForm.name;

            data.gymProfile = {
                upsert: {
                    update: {
                        name: gymForm.name,
                        address: gymForm.address,
                        phone: gymForm.phone,
                        website: gymForm.website,
                        fee: feeNum,
                        ...(geocoded
                            ? {
                                  city: geocoded.city,
                                  state: geocoded.state,
                                  country: geocoded.country,
                                  lat: geocoded.lat,
                                  lng: geocoded.lng,
                              }
                            : {}),
                    },
                    create: {
                        name: gymForm.name,
                        address: gymForm.address,
                        phone: gymForm.phone,
                        website: gymForm.website,
                        fee: feeNum,
                        ...(geocoded
                            ? {
                                  city: geocoded.city,
                                  state: geocoded.state,
                                  country: geocoded.country,
                                  lat: geocoded.lat,
                                  lng: geocoded.lng,
                              }
                            : {}),
                    },
                },
            };
        }

        const user = await db.user.update({
            where: { id: current.id },
            data,
            select: {
                id: true,
                email: true,
                username: true,
                name: true,
                image: true,
                traineeProfile: true,
                trainerProfile: true,
                gymProfile: true,
            },
        });

        const res = NextResponse.json({ user, message: "User updated" });
        res.cookies.delete("onboarding_token");

        const sessionMaxAge = authOptions.session?.maxAge ?? 60 * 60;
        const sessionToken = await encode({
            token: {
                sub: user.id,
                email: user.email,
                name: user.name ?? user.username ?? user.email ?? undefined,
                picture: user.image ?? undefined,
                username: user.username,
            },
            secret: env.NEXTAUTH_SECRET,
            maxAge: sessionMaxAge,
        });

        const cookieConfigs = [
            { name: "next-auth.session-token", secure: false },
            { name: "__Secure-next-auth.session-token", secure: true },
        ];

        cookieConfigs.forEach(({ name, secure }) => {
            res.cookies.set(name, sessionToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: secure ? true : env.NODE_ENV === "production",
                path: "/",
                maxAge: sessionMaxAge,
            });
        });

        res.cookies.set("next-auth.callback-url", "/home", {
            httpOnly: false,
            sameSite: "lax",
            secure: env.NODE_ENV === "production",
            path: "/",
            maxAge: 30 * 24 * 60 * 60,
        });

        return res;
    } catch (err: any) {
        console.error("update-role error:", err);
        // surface a useful message if possible
        return NextResponse.json(
            { message: err?.message || "Update failed" },
            { status: 500 }
        );
    }
}
