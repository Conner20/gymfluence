'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/prisma/client';

/** ---------------- Auth helper (matches nutritionActions) ---------------- */
async function requireMe() {
    const session = await getServerSession(authOptions);
    const sUser = session?.user as { id?: string; email?: string } | undefined;

    if (!sUser?.id && !sUser?.email) {
        throw new Error('Unauthorized');
    }

    const me = await db.user.findFirst({
        where: sUser?.id ? { id: sUser.id } : { email: sUser!.email! },
        select: { id: true },
    });

    if (!me) throw new Error('User not found');
    return me.id;
}

/** ---------------- Date helpers (normalize to UTC midnight) ---------------- */
function toUTCDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00Z');
}
function toISODate(d: Date): string {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return x.toISOString().slice(0, 10);
}

/** ---------------- DTOs ---------------- */
export type SleepDTO = { date: string; hours: number | null };
export type WaterDTO = { date: string; liters: number };
export type WellnessSettingsDTO = {
    waterGoal: number;
    unit?: 'lbs' | 'kg';
    bwRange?: '1W' | '1M' | '3M' | '1Y' | 'ALL';
};

/** ---------------- Fetch all ---------------- */
export async function fetchWellnessData(): Promise<{
    sleep: SleepDTO[];
    water: WaterDTO[];
    settings: WellnessSettingsDTO;
}> {
    const userId = await requireMe();

    const [sleepRows, waterRows, settings] = await Promise.all([
        db.sleepEntry.findMany({
            where: { userId },
            orderBy: { date: 'asc' },
            select: { date: true, hours: true },
        }),
        db.waterEntry.findMany({
            where: { userId },
            orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
            select: { date: true, liters: true },
        }),
        db.wellnessSettings.upsert({
            where: { userId },
            update: {},
            create: { userId, waterGoal: 3.2 },
            select: { waterGoal: true, unit: true, bwRange: true },
        }),
    ]);

    return {
        sleep: sleepRows.map((r: typeof sleepRows[number]) => ({
            date: toISODate(r.date),
            hours: r.hours ?? null,
        })),
        water: waterRows.map((r: typeof waterRows[number]) => ({
            date: toISODate(r.date),
            liters: r.liters,
        })),
        settings: {
            waterGoal: settings.waterGoal,
            unit: (settings.unit as 'lbs' | 'kg' | null) ?? undefined,
            bwRange: (settings.bwRange as WellnessSettingsDTO['bwRange'] | null) ?? undefined,
        },
    };
}

/** ---------------- Mutations ---------------- */

export async function upsertSleepServer(input: { date: string; hours: number | null }): Promise<SleepDTO> {
    const userId = await requireMe();
    const date = toUTCDate(input.date);

    const up = await db.sleepEntry.upsert({
        where: { userId_date: { userId, date } },
        update: { hours: input.hours },
        create: { userId, date, hours: input.hours },
        select: { date: true, hours: true },
    });

    return { date: toISODate(up.date), hours: up.hours ?? null };
}

export async function addWaterServer(input: { date: string; liters: number }): Promise<WaterDTO> {
    const userId = await requireMe();
    const created = await db.waterEntry.create({
        data: { userId, date: toUTCDate(input.date), liters: input.liters },
        select: { date: true, liters: true },
    });
    return { date: toISODate(created.date), liters: created.liters };
}

export async function setWaterGoalServer(goal: number): Promise<{ waterGoal: number }> {
    const userId = await requireMe();
    const next = Math.max(0.1, Math.min(goal, 20));
    const row = await db.wellnessSettings.upsert({
        where: { userId },
        update: { waterGoal: next },
        create: { userId, waterGoal: next },
        select: { waterGoal: true },
    });
    return { waterGoal: row.waterGoal };
}

// Optional: persist UI prefs for bodyweight chart (unit/range)
export async function setWellnessPrefsServer(prefs: {
    unit?: 'lbs' | 'kg';
    bwRange?: '1W' | '1M' | '3M' | '1Y' | 'ALL';
}) {
    const userId = await requireMe();
    await db.wellnessSettings.upsert({
        where: { userId },
        update: { unit: prefs.unit, bwRange: prefs.bwRange },
        create: { userId, waterGoal: 3.2, unit: prefs.unit, bwRange: prefs.bwRange },
    });
    return { ok: true };
}
