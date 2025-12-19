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

export type MacroGoalsDTO = { kcal: number; p: number; f: number; c: number };
export type HMMetric = 'kcal' | 'f' | 'c' | 'p';
export type HeatmapLevelsDTO = Record<HMMetric, number[]>;

const DEFAULT_MACRO_GOALS: MacroGoalsDTO = { kcal: 2800, p: 200, f: 80, c: 300 };
const DEFAULT_HEATMAP_LEVELS: HeatmapLevelsDTO = {
    kcal: [0, 2200, 2600, 3000, Infinity],
    f: [0, 20, 40, 60, Infinity],
    c: [0, 60, 120, 180, Infinity],
    p: [0, 50, 100, 150, Infinity],
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
type NutritionSettingsDTO = {
    goals: MacroGoalsDTO;
    heatmapLevels: HeatmapLevelsDTO;
};

function clampGoal(value: number, min = 0, max = 10_000) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function sanitizeGoals(goals: MacroGoalsDTO): MacroGoalsDTO {
    return {
        kcal: clampGoal(goals.kcal, 0, 10_000),
        p: clampGoal(goals.p, 0, 1000),
        f: clampGoal(goals.f, 0, 1000),
        c: clampGoal(goals.c, 0, 1500),
    };
}

function encodeHeatmapLevels(levels: HeatmapLevelsDTO): Record<HMMetric, (number | null)[]> {
    const next: Record<HMMetric, (number | null)[]> = { kcal: [], f: [], c: [], p: [] } as any;
    (['kcal', 'f', 'c', 'p'] as HMMetric[]).forEach((key) => {
        const arr = Array.isArray(levels[key]) ? levels[key] : DEFAULT_HEATMAP_LEVELS[key];
        next[key] = arr.map((val) => (Number.isFinite(val) ? val : null));
    });
    return next;
}

function decodeHeatmapLevels(raw: unknown): HeatmapLevelsDTO {
    const next: HeatmapLevelsDTO = {
        kcal: [...DEFAULT_HEATMAP_LEVELS.kcal],
        f: [...DEFAULT_HEATMAP_LEVELS.f],
        c: [...DEFAULT_HEATMAP_LEVELS.c],
        p: [...DEFAULT_HEATMAP_LEVELS.p],
    };
    if (!raw || typeof raw !== 'object') return next;
    (['kcal', 'f', 'c', 'p'] as HMMetric[]).forEach((key) => {
        const arr = (raw as Record<string, unknown>)[key];
        if (Array.isArray(arr) && arr.length >= 5) {
            next[key] = arr.map((val, idx) => {
                if (idx === arr.length - 1 && (val === null || val === undefined)) return Infinity;
                return typeof val === 'number' && Number.isFinite(val) ? val : 0;
            });
            if (!Number.isFinite(next[key][next[key].length - 1])) {
                next[key][next[key].length - 1] = Infinity;
            }
        }
    });
    return next;
}

function defaultSettings(): NutritionSettingsDTO {
    return {
        goals: { ...DEFAULT_MACRO_GOALS },
        heatmapLevels: {
            kcal: [...DEFAULT_HEATMAP_LEVELS.kcal],
            f: [...DEFAULT_HEATMAP_LEVELS.f],
            c: [...DEFAULT_HEATMAP_LEVELS.c],
            p: [...DEFAULT_HEATMAP_LEVELS.p],
        },
    };
}

export async function fetchAllNutritionData(): Promise<{
    entries: NutritionEntryDTO[];
    bodyweights: BodyweightDTO[];
    customFoods: CustomFoodDTO[];
    settings: NutritionSettingsDTO;
}> {
    const userId = await requireMe();

    const [entries, bodyweights, customFoods, settings] = await Promise.all([
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
        db.nutritionSettings.findUnique({
            where: { userId },
            select: {
                goalKcal: true,
                goalProtein: true,
                goalFat: true,
                goalCarb: true,
                heatmapLevels: true,
            },
        }),
    ]);

    const settingsDTO = settings
        ? {
            goals: {
                kcal: settings.goalKcal,
                p: settings.goalProtein,
                f: settings.goalFat,
                c: settings.goalCarb,
            },
            heatmapLevels: decodeHeatmapLevels(settings.heatmapLevels),
        }
        : defaultSettings();

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
        settings: settingsDTO,
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

export async function saveMacroGoalsServer(goals: MacroGoalsDTO): Promise<MacroGoalsDTO> {
    const userId = await requireMe();
    const clean = sanitizeGoals(goals);
    const updated = await db.nutritionSettings.upsert({
        where: { userId },
        update: {
            goalKcal: clean.kcal,
            goalProtein: clean.p,
            goalFat: clean.f,
            goalCarb: clean.c,
        },
        create: {
            userId,
            goalKcal: clean.kcal,
            goalProtein: clean.p,
            goalFat: clean.f,
            goalCarb: clean.c,
            heatmapLevels: encodeHeatmapLevels(DEFAULT_HEATMAP_LEVELS),
        },
        select: {
            goalKcal: true,
            goalProtein: true,
            goalFat: true,
            goalCarb: true,
        },
    });
    return {
        kcal: updated.goalKcal,
        p: updated.goalProtein,
        f: updated.goalFat,
        c: updated.goalCarb,
    };
}

export async function saveHeatmapLevelsServer(levels: HeatmapLevelsDTO): Promise<HeatmapLevelsDTO> {
    const userId = await requireMe();
    const sanitized: HeatmapLevelsDTO = {
        kcal: levels.kcal?.length ? levels.kcal : DEFAULT_HEATMAP_LEVELS.kcal,
        f: levels.f?.length ? levels.f : DEFAULT_HEATMAP_LEVELS.f,
        c: levels.c?.length ? levels.c : DEFAULT_HEATMAP_LEVELS.c,
        p: levels.p?.length ? levels.p : DEFAULT_HEATMAP_LEVELS.p,
    };
    const encoded = encodeHeatmapLevels(sanitized);
    const existing = await db.nutritionSettings.upsert({
        where: { userId },
        update: { heatmapLevels: encoded },
        create: {
            userId,
            heatmapLevels: encoded,
            goalKcal: DEFAULT_MACRO_GOALS.kcal,
            goalProtein: DEFAULT_MACRO_GOALS.p,
            goalFat: DEFAULT_MACRO_GOALS.f,
            goalCarb: DEFAULT_MACRO_GOALS.c,
        },
        select: { heatmapLevels: true },
    });
    return decodeHeatmapLevels(existing.heatmapLevels);
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
