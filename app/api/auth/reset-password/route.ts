// app/api/auth/reset-password/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db as prisma } from '@/prisma/client';
import { sha256Hex } from '@/lib/token';

export async function POST(req: Request) {
    try {
        const { token, password } = (await req.json()) as { token?: string; password?: string };
        if (!token || !password || password.length < 8) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Hash the raw token from the URL and look it up by hash
        const tokenHash = sha256Hex(token);

        const vt = await prisma.verificationToken.findFirst({
            where: { token: tokenHash },
        });

        if (!vt || vt.expires < new Date()) {
            return NextResponse.json({ error: 'Invalid/expired' }, { status: 400 });
        }

        const email = vt.identifier;

        // Hash the new password and update the user
        const hash = await bcrypt.hash(password, 12);
        await prisma.user.update({
            where: { email },
            data: { password: hash },
        });

        // Burn ALL tokens for this identifier
        await prisma.verificationToken.deleteMany({ where: { identifier: email } });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
