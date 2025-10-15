'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/prisma/client';

/** ---------------- Auth helper ---------------- */
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

/** --------------- Types used by the dashboard --------------- */
export type SetEntry = {
    id: string;
    exercise: string;
    weight: number;
    sets: number;
    reps: number;
    date: string; // YYYY-MM-DD
};

/** --------------- Public API used by the Dashboard --------------- */
export async function fetchAllDashboardData() {
    const userId = await requireMe();

    // Exercises list (names only)
    const exercises = await db.workoutExercise.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
        select: { name: true },
    });

    // All sets for this user (latest first)
    const sets = await db.workoutSet.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { id: 'desc' }], // tie-breaker by id
        select: {
            id: true,
            date: true,
            weight: true,
            sets: true,
            reps: true,
            exercise: { select: { name: true } },
        },
    });

    const setEntries: SetEntry[] = sets.map((s) => ({
        id: s.id,
        date: s.date.toISOString().slice(0, 10),
        weight: s.weight,
        sets: s.sets,
        reps: s.reps,
        exercise: s.exercise.name,
    }));

    // Split (single row with items: string[])
    const splitRow = await db.workoutSplit.findFirst({
        where: { userId },
        select: { items: true },
    });

    return {
        exercises: exercises.map((e) => e.name),
        sets: setEntries,
        split: splitRow?.items ?? ['rest', 'legs', 'push', 'pull'],
    };
}

export async function addExerciseServer(name: string) {
    const userId = await requireMe();
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) throw new Error('Exercise name required');

    // Ensure unique per user + name
    const existing = await db.workoutExercise.findFirst({
        where: { userId, name: trimmed },
        select: { id: true, name: true },
    });
    if (existing) return existing;

    return db.workoutExercise.create({
        data: { userId, name: trimmed },
        select: { id: true, name: true },
    });
}

export async function addSetServer(input: {
    exerciseName: string;
    weight: number;
    sets: number;
    reps: number;
    date: string; // YYYY-MM-DD
}) {
    const userId = await requireMe();
    const name = input.exerciseName.trim().toLowerCase();
    if (!name) throw new Error('exerciseName required');

    // Find or create the exercise
    let ex = await db.workoutExercise.findFirst({
        where: { userId, name },
        select: { id: true },
    });
    if (!ex) {
        ex = await db.workoutExercise.create({
            data: { userId, name },
            select: { id: true },
        });
    }

    const created = await db.workoutSet.create({
        data: {
            userId,
            exerciseId: ex.id,
            date: new Date(input.date),
            weight: input.weight,
            sets: input.sets,
            reps: input.reps,
        },
        select: {
            id: true,
            date: true,
            weight: true,
            sets: true,
            reps: true,
            exercise: { select: { name: true } },
        },
    });

    const result: SetEntry = {
        id: created.id,
        date: created.date.toISOString().slice(0, 10),
        weight: created.weight,
        sets: created.sets,
        reps: created.reps,
        exercise: created.exercise.name,
    };
    return result;
}

export async function deleteSetServer(id: string) {
    const userId = await requireMe();

    // Ensure the set belongs to this user
    const found = await db.workoutSet.findFirst({
        where: { id, userId },
        select: { id: true },
    });
    if (!found) return { deleted: false };

    await db.workoutSet.delete({ where: { id } });
    return { deleted: true };
}

export async function saveSplitServer(items: string[]) {
    const userId = await requireMe();
    const cleaned = items
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

    if (!cleaned.length) throw new Error('Split must have at least one item');

    const existing = await db.workoutSplit.findFirst({
        where: { userId },
        select: { id: true },
    });

    if (existing) {
        await db.workoutSplit.update({
            where: { id: existing.id },
            data: { items: cleaned },
        });
    } else {
        await db.workoutSplit.create({
            data: { userId, items: cleaned },
        });
    }

    return { ok: true };
}
