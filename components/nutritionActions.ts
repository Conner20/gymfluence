'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/prisma/client';

/** ---------------- Auth helper (same pattern as workoutActions) ---------------- */
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

/** ---------------- Types used by the Nutrition Dashboard ---------------- */
export type NutritionEntryDTO = {
    id: string;
    date: string; // YYYY-MM-DD (UTC)
    meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    foodName: string;
    servings: number;
    kcal: number;
    p: number;
    c: number;
    f: number;
    time?: string | null;
    customFoodId?: string | null;
};

export type BodyweightDTO = { date: string; weight: number };

export type CustomFoodDTO = {
    id: string;
    name: string;
    grams: number;
    kcal: number;
    p: number;
    c: number;
    f: number;
};

/** ---------------- Date helpers (normalize to UTC midnight) ---------------- */
function toUTCDate(dateStr: string): Date {
    // Ensure UTC midnight; avoid local TZ drift
    return new Date(dateStr + 'T00:00:00Z');
}
function toISODate(d: Date): string {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return x.toISOString().slice(0, 10);
}

/** ---------------- Public API used by the Nutrition page ---------------- */
export async function fetchAllNutritionData(): Promise<{
    entries: NutritionEntryDTO[];
    bodyweights: BodyweightDTO[];
    customFoods: CustomFoodDTO[];
}> {
    const userId = await requireMe();

    const [entries, bodyweights, customFoods] = await Promise.all([
        db.nutritionEntry.findMany({
            where: { userId },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            select: {
                id: true,
                date: true,
                meal: true,
                foodName: true,
                servings: true,
                kcal: true,
                p: true,
                c: true,
                f: true,
                time: true,
                customFoodId: true,
            },
        }),
        db.bodyweightEntry.findMany({
            where: { userId },
            orderBy: [{ date: 'asc' }],
            select: { date: true, weight: true },
        }),
        db.nutritionCustomFood.findMany({
            where: { userId },
            orderBy: [{ createdAt: 'desc' }],
            select: { id: true, name: true, grams: true, kcal: true, p: true, c: true, f: true },
        }),
    ]);

    return {
        entries: entries.map((e: typeof entries[number]) => ({
            id: e.id,
            date: toISODate(e.date),
            meal: e.meal,
            foodName: e.foodName,
            servings: e.servings,
            kcal: e.kcal,
            p: e.p,
            c: e.c,
            f: e.f,
            time: e.time,
            customFoodId: e.customFoodId ?? null,
        })),
        bodyweights: bodyweights.map((b: typeof bodyweights[number]) => ({
            date: toISODate(b.date),
            weight: b.weight,
        })),
        customFoods: customFoods.map((cf: typeof customFoods[number]) => ({
            id: cf.id,
            name: cf.name,
            grams: cf.grams,
            kcal: cf.kcal,
            p: cf.p,
            c: cf.c,
            f: cf.f,
        })),
    };
}

export async function addNutritionEntryServer(input: {
    date: string; // 'YYYY-MM-DD'
    meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    foodName: string;
    servings: number;
    kcal: number;
    p: number;
    c: number;
    f: number;
    time?: string;
    customFoodId?: string | null;
}): Promise<NutritionEntryDTO> {
    const userId = await requireMe();

    const created = await db.nutritionEntry.create({
        data: {
            userId,
            date: toUTCDate(input.date),
            meal: input.meal,
            foodName: input.foodName,
            servings: input.servings,
            kcal: input.kcal,
            p: input.p,
            c: input.c,
            f: input.f,
            time: input.time ?? null,
            customFoodId: input.customFoodId ?? null,
        },
        select: {
            id: true,
            date: true,
            meal: true,
            foodName: true,
            servings: true,
            kcal: true,
            p: true,
            c: true,
            f: true,
            time: true,
            customFoodId: true,
        },
    });

    return {
        id: created.id,
        date: toISODate(created.date),
        meal: created.meal,
        foodName: created.foodName,
        servings: created.servings,
        kcal: created.kcal,
        p: created.p,
        c: created.c,
        f: created.f,
        time: created.time,
        customFoodId: created.customFoodId ?? null,
    };
}

export async function deleteNutritionEntryServer(id: string): Promise<{ deleted: boolean }> {
    const userId = await requireMe();

    // Ensure ownership before delete (same pattern used in workoutActions)
    const found = await db.nutritionEntry.findFirst({
        where: { id, userId },
        select: { id: true },
    });
    if (!found) return { deleted: false };

    await db.nutritionEntry.delete({ where: { id } });
    return { deleted: true };
}

export async function upsertBodyweightServer(bw: {
    date: string; // 'YYYY-MM-DD'
    weight: number;
}): Promise<BodyweightDTO> {
    const userId = await requireMe();
    const date = toUTCDate(bw.date);

    const up = await db.bodyweightEntry.upsert({
        where: { userId_date: { userId, date } }, // relies on @@unique([userId, date])
        update: { weight: bw.weight },
        create: { userId, date, weight: bw.weight },
        select: { date: true, weight: true },
    });

    return { date: toISODate(up.date), weight: up.weight };
}

export async function saveCustomFoodServer(cf: {
    name: string;
    grams: number;
    kcal: number;
    p: number;
    c: number;
    f: number;
}): Promise<CustomFoodDTO> {
    const userId = await requireMe();

    const created = await db.nutritionCustomFood.create({
        data: {
            userId,
            name: cf.name,
            grams: cf.grams,
            kcal: cf.kcal,
            p: cf.p,
            c: cf.c,
            f: cf.f,
        },
        select: { id: true, name: true, grams: true, kcal: true, p: true, c: true, f: true },
    });

    return {
        id: created.id,
        name: created.name,
        grams: created.grams,
        kcal: created.kcal,
        p: created.p,
        c: created.c,
        f: created.f,
    };
}
