import { env } from "@/lib/env";

export function isAdminEmail(email: string | null | undefined) {
    if (!email) return false;
    return env.ADMIN_EMAILS.split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
        .includes(email.toLowerCase());
}
