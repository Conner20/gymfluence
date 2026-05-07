import { env } from "@/lib/env";

export type GeocodedAddress = {
    lat: number;
    lng: number;
    city: string | null;
    state: string | null;
    country: string | null;
    formattedAddress: string | null;
};

function pickAddressComponent(
    components: Array<{ long_name?: string; short_name?: string; types?: string[] }> | undefined,
    type: string,
    format: "long" | "short" = "long"
) {
    const component = components?.find((entry) => entry.types?.includes(type));
    if (!component) return null;
    return format === "short" ? component.short_name ?? component.long_name ?? null : component.long_name ?? component.short_name ?? null;
}

export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
    const trimmed = address.trim();
    if (!trimmed || !env.GOOGLE_PLACES_API_KEY) return null;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${encodeURIComponent(env.GOOGLE_PLACES_API_KEY)}`;
    const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Geocoding failed with status ${response.status}.`);
    }

    const data = await response.json().catch(() => null);
    if (!data || data.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) {
        return null;
    }

    const result = data.results[0];
    const location = result?.geometry?.location;
    if (typeof location?.lat !== "number" || typeof location?.lng !== "number") {
        return null;
    }

    return {
        lat: location.lat,
        lng: location.lng,
        city: pickAddressComponent(result.address_components, "locality")
            ?? pickAddressComponent(result.address_components, "postal_town")
            ?? pickAddressComponent(result.address_components, "administrative_area_level_2"),
        state: pickAddressComponent(result.address_components, "administrative_area_level_1", "short"),
        country: pickAddressComponent(result.address_components, "country"),
        formattedAddress: typeof result.formatted_address === "string" ? result.formatted_address : null,
    };
}
