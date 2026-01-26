import { NextResponse } from 'next/server';
import { sendPasswordResetEmail } from '@/lib/mail';
import { db as prisma } from '@/prisma/client';
import { generateRawToken } from '@/lib/token';

export async function POST(req: Request) {
    try {
        const { email } = (await req.json()) as { email?: string };
        if (!email) {
            return NextResponse.json({ error: 'Missing email' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Always return 200 to avoid email enumeration
        if (!user) {
            return NextResponse.json({ ok: true });
        }

        // Invalidate any prior tokens for this identifier
        await prisma.verificationToken.deleteMany({ where: { identifier: email } });

        // Create raw token (sent to user) and a hashed version (stored)
        const rawToken = generateRawToken(32);
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

        // Store the HASH in the `token` column (do not store raw)
        await prisma.verificationToken.create({
            data: { identifier: email, token: rawToken, expires },
        });

        const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';

        // If baseUrl is empty, we still respond ok — but you’ll want this set for real emails
        const resetUrl = `${baseUrl}/reset-password/${rawToken}`;

        await sendPasswordResetEmail(email, resetUrl);

        return NextResponse.json({ ok: true });
    } catch {
        // Still 200 to prevent probing; log server-side if desired
        return NextResponse.json({ ok: true });
    }
}
