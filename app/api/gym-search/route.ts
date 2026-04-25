import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (!q || q.length < 2) {
        return NextResponse.json({ results: [] });
    }

    if (!env.GOOGLE_PLACES_API_KEY) {
        return NextResponse.json(
            {
                results: [],
                message: "GOOGLE_PLACES_API_KEY is not configured.",
            },
            { status: 503 }
        );
    }

    try {
        const upstream = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
                "X-Goog-FieldMask":
                    "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.types",
            },
            body: JSON.stringify({
                input: q,
                includedPrimaryTypes: ["gym"],
                languageCode: "en",
                regionCode: "US",
            }),
            cache: "no-store",
        });

        if (!upstream.ok) {
            const errorText = await upstream.text().catch(() => "");
            console.error("Google Places autocomplete error:", upstream.status, upstream.statusText, errorText);
            return NextResponse.json(
                { results: [], message: "Google Places autocomplete failed." },
                { status: 502 }
            );
        }

        const data = await upstream.json();
        const results = (data.suggestions ?? [])
            .map((suggestion: any) => suggestion?.placePrediction)
            .filter(Boolean)
            .map((place: any) => ({
                id: String(place.placeId ?? ""),
                name: place.text?.text ?? "",
                address: "",
            }))
            .filter((place: { id: string; name: string }) => place.id && place.name);

        return NextResponse.json({ results });
    } catch (error) {
        console.error("Google Places gym search error:", error);
        return NextResponse.json(
            { results: [], message: "Google Places gym search failed." },
            { status: 500 }
        );
    }
}
