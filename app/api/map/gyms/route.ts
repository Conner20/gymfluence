import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocoding";
import { db } from "@/prisma/client";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const gymsNeedingCoords = await db.user.findMany({
        where: {
            role: "GYM",
            gymProfile: {
                is: {
                    address: { not: "" },
                    OR: [
                        { lat: null },
                        { lng: null },
                    ],
                },
            },
        },
        select: {
            id: true,
            gymProfile: {
                select: {
                    address: true,
                },
            },
        },
    });

    await Promise.all(
        gymsNeedingCoords.map(async (gym) => {
            const address = gym.gymProfile?.address?.trim();
            if (!address) return;

            try {
                const geocoded = await geocodeAddress(address);
                if (!geocoded) return;

                await db.gymProfile.update({
                    where: { userId: gym.id },
                    data: {
                        city: geocoded.city,
                        state: geocoded.state,
                        country: geocoded.country,
                        lat: geocoded.lat,
                        lng: geocoded.lng,
                    },
                });
            } catch (error) {
                console.error(`gym map geocode failed for ${gym.id}:`, error);
            }
        })
    );

    const gyms = await db.user.findMany({
        where: {
            role: "GYM",
            gymProfile: {
                is: {
                    lat: { not: null },
                    lng: { not: null },
                },
            },
        },
        select: {
            id: true,
            username: true,
            name: true,
            image: true,
            bio: true,
            searchGalleryImages: {
                select: { url: true },
                orderBy: { createdAt: "desc" },
                take: 18,
            },
            gymProfile: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    city: true,
                    state: true,
                    country: true,
                    lat: true,
                    lng: true,
                    fee: true,
                    rating: true,
                    clients: true,
                    hiringTrainers: true,
                    bio: true,
                    isVerified: true,
                    amenities: true,
                },
            },
        },
        orderBy: [
            { gymProfile: { name: "asc" } },
            { username: "asc" },
        ],
    });

    const results = gyms
        .filter((gym) => gym.gymProfile?.lat != null && gym.gymProfile?.lng != null)
        .map((gym) => ({
            id: gym.id,
            username: gym.username,
            name: gym.name,
            image: gym.image,
            gymProfile: {
                id: gym.gymProfile!.id,
                name: gym.gymProfile!.name,
                address: gym.gymProfile!.address,
                city: gym.gymProfile!.city,
                state: gym.gymProfile!.state,
                country: gym.gymProfile!.country,
                lat: gym.gymProfile!.lat!,
                lng: gym.gymProfile!.lng!,
                fee: gym.gymProfile!.fee,
                rating: gym.gymProfile!.rating,
                clients: gym.gymProfile!.clients,
                hiringTrainers: gym.gymProfile!.hiringTrainers,
                bio: gym.gymProfile!.bio,
                isVerified: gym.gymProfile!.isVerified,
                amenities: gym.gymProfile!.amenities ?? [],
            },
            about: gym.bio ?? gym.gymProfile!.bio ?? null,
            gallery: gym.searchGalleryImages.map((image) => image.url),
        }));

    return NextResponse.json({ gyms: results });
}
