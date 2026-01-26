import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import { db as prisma } from '@/prisma/client';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const token = url.searchParams.get('token')?.trim();

        if (!token) {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 });
        }

        const vt = await prisma.verificationToken.findFirst({ where: { token } });

        if (!vt || vt.expires < new Date()) {
            return NextResponse.json({ error: 'Invalid/expired' }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[reset-password-validate]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { token, password } = (await req.json()) as { token?: string; password?: string };
        const normalizedToken = token?.trim();
        const sanitizedPassword = password?.trim();

        if (!normalizedToken || !sanitizedPassword || sanitizedPassword.length < 8) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const vt = await prisma.verificationToken.findFirst({
            where: { token: normalizedToken },
        });

        if (!vt || vt.expires < new Date()) {
            return NextResponse.json({ error: 'Invalid/expired' }, { status: 400 });
        }

        const email = vt.identifier;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            await prisma.verificationToken.deleteMany({ where: { identifier: email } });
            return NextResponse.json({ error: 'Invalid/expired' }, { status: 400 });
        }

        const hash = await bcrypt.hash(sanitizedPassword, 12);
        await prisma.user.update({
            where: { email },
            data: { password: hash },
        });

        await prisma.verificationToken.deleteMany({ where: { identifier: email } });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[reset-password]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
