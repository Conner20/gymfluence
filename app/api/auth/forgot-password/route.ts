import { NextResponse } from 'next/server';

import { sendPasswordResetEmail } from '@/lib/mail';
import { getBaseUrl } from '@/lib/base-url';
import { generateRawToken } from '@/lib/token';
import { db as prisma } from '@/prisma/client';

export async function POST(req: Request) {
    try {
        const { email } = (await req.json()) as { email?: string };
        const normalizedEmail = email?.trim().toLowerCase();

        if (!normalizedEmail) {
            return NextResponse.json({ error: 'Missing email' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        // Always respond with 200 to avoid email enumeration even when user is missing.
        if (!user) {
            return NextResponse.json({ ok: true });
        }

        await prisma.verificationToken.deleteMany({ where: { identifier: normalizedEmail } });

        const rawToken = generateRawToken(32);
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.verificationToken.create({
            data: {
                identifier: normalizedEmail,
                token: rawToken,
                expires,
            },
        });

        const baseUrl = getBaseUrl();
        const resetUrl = `${baseUrl}/reset-password/${rawToken}`;

        await sendPasswordResetEmail(normalizedEmail, resetUrl);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[forgot-password]', error);
        // Still return 200 to prevent probing attacks.
        return NextResponse.json({ ok: true });
    }
}
