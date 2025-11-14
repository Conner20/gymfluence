// app/api/location-search/route.ts
import { NextResponse } from "next/server";

/**
 * Proxies to Open-Meteo Geocoding API:
 * https://geocoding-api.open-meteo.com/v1/search
 *
 * No API key required for non-commercial use.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    // Open-Meteo returns empty for < 2 chars anyway; we short-circuit
    if (!q || q.length < 2) {
        return NextResponse.json({ results: [] });
    }

    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", q);
    url.searchParams.set("count", "5");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    try {
        const upstream = await fetch(url.toString(), {
            // cache lightly; this is okay because city coordinates don't change often
            next: { revalidate: 60 },
        });

        if (!upstream.ok) {
            console.error("Open-Meteo geocoding error:", upstream.status, upstream.statusText);
            return NextResponse.json({ results: [] }, { status: 502 });
        }

        const data = await upstream.json();

        const results =
            (data.results ?? []).map((r: any) => {
                const city = r.name ?? null;
                const state = r.admin1 ?? null;
                const country = r.country ?? null;
                const labelParts = [city, state, country].filter(Boolean);
                const label = labelParts.join(", ");

                return {
                    id: String(r.id),
                    label,
                    city,
                    state,
                    country,
                    lat: r.latitude,
                    lng: r.longitude,
                };
            }) ?? [];

        return NextResponse.json({ results });
    } catch (err) {
        console.error("Error calling Open-Meteo geocoding:", err);
        return NextResponse.json({ results: [] }, { status: 500 });
    }
}
