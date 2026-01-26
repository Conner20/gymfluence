import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is missing"),
    NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is missing"),
});

const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
});

if (!parsed.success) {
    console.error(
        "❌ Invalid environment variables:",
        parsed.error.flatten().fieldErrors
    );
    throw new Error("Missing or invalid environment variables. Check your .env setup.");
}

export const env = parsed.data;
