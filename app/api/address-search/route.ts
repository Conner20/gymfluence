import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (!q || q.length < 3) {
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
                    "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
            },
            body: JSON.stringify({
                input: q,
                includedRegionCodes: ["US"],
                languageCode: "en",
            }),
            cache: "no-store",
        });

        if (!upstream.ok) {
            const errorText = await upstream.text().catch(() => "");
            console.error("Google Places address autocomplete error:", upstream.status, upstream.statusText, errorText);
            return NextResponse.json(
                { results: [], message: "Google Places address autocomplete failed." },
                { status: 502 }
            );
        }

        const data = await upstream.json();
        const results = (data.suggestions ?? [])
            .map((suggestion: any) => suggestion?.placePrediction)
            .filter(Boolean)
            .map((place: any) => ({
                id: String(place.placeId ?? ""),
                label: place.text?.text ?? "",
            }))
            .filter((place: { id: string; label: string }) => place.id && place.label);

        return NextResponse.json({ results });
    } catch (error) {
        console.error("Google Places address search error:", error);
        return NextResponse.json(
            { results: [], message: "Google Places address search failed." },
            { status: 500 }
        );
    }
}
