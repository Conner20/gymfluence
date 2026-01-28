import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is missing"),
    NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is missing"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    ADMIN_EMAILS: z.string().default(""),
});

const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "",
});

if (!parsed.success) {
    console.error(
        "❌ Invalid environment variables:",
        parsed.error.flatten().fieldErrors
    );
    throw new Error("Missing or invalid environment variables. Check your .env setup.");
}

export const env = parsed.data;
