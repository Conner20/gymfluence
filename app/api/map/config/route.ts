import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export async function GET() {
    return NextResponse.json({
        googleMapsApiKey: env.GOOGLE_PLACES_API_KEY ?? null,
    });
}
