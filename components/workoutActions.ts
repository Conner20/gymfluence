'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/prisma/client';
import { DEFAULT_CARDIO_ACTIVITIES } from '@/lib/workoutDefaults';

export type CardioMode = string;
export type DistanceUnit = 'mi' | 'km';

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

export type CardioSessionEntry = {
    id: string;
    activity: CardioMode;
    timeMinutes: number;
    distance: number | null;
    distanceUnit: DistanceUnit;
    calories: number | null;
    date: string; // YYYY-MM-DD
};

/** --------------- Public API used by the Dashboard --------------- */
export async function fetchAllDashboardData(viewUserId?: string) {
    let viewerId: string | null = null;
    try {
        viewerId = await requireMe();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'Unauthorized' || message === 'User not found') {
            return {
                requiresAuth: true,
                exercises: [],
                cardioActivities: [],
                sets: [],
                cardioSessions: [],
            };
        }
        throw err;
    }

    let targetUserId = viewerId;
    let viewingUser: { id: string; name: string | null; username: string | null } | null = null;
    const requestedView = viewUserId && viewUserId !== viewerId ? viewUserId : null;

    if (requestedView) {
        const share = await db.dashboardShare.findUnique({
            where: { ownerId_viewerId: { ownerId: requestedView, viewerId: viewerId! } },
            select: {
                workouts: true,
                owner: { select: { id: true, name: true, username: true } },
            },
        });
        if (!share?.workouts) {
            return {
                requiresAuth: true,
                exercises: [],
                cardioActivities: [],
                sets: [],
                cardioSessions: [],
            };
        }
        targetUserId = requestedView;
        viewingUser = share.owner;
    }

    // Exercises list (names only)
    const exercises = await db.workoutExercise.findMany({
        where: { userId: targetUserId },
        orderBy: { name: 'asc' },
        select: { name: true },
    });

    let cardioActivities = await db.cardioActivityEntry.findMany({
        where: { userId: targetUserId },
        orderBy: { name: 'asc' },
        select: { name: true },
    });
    if (cardioActivities.length === 0) {
        await db.cardioActivityEntry.createMany({
            data: DEFAULT_CARDIO_ACTIVITIES.map((name) => ({
                userId: targetUserId,
                name,
            })),
            skipDuplicates: true,
        });
        cardioActivities = await db.cardioActivityEntry.findMany({
            where: { userId: targetUserId },
            orderBy: { name: 'asc' },
            select: { name: true },
        });
    }

    // All sets for this user (latest first)
    const sets = await db.workoutSet.findMany({
        where: { userId: targetUserId },
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

    const setEntries: SetEntry[] = sets.map((s: typeof sets[number]) => ({
        id: s.id,
        date: s.date.toISOString().slice(0, 10),
        weight: s.weight,
        sets: s.sets,
        reps: s.reps,
        exercise: s.exercise.name,
    }));

    const cardioRows = await db.cardioSession.findMany({
        where: { userId: targetUserId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
            id: true,
            activity: { select: { name: true } },
            date: true,
            timeMinutes: true,
            distance: true,
            distanceUnit: true,
            calories: true,
        },
    });

    const cardioSessions: CardioSessionEntry[] = cardioRows.map((row) => ({
        id: row.id,
        activity: row.activity?.name ?? 'cardio',
        date: row.date.toISOString().slice(0, 10),
        timeMinutes: row.timeMinutes,
        distance: row.distance ?? null,
        distanceUnit: (row.distanceUnit as DistanceUnit) ?? 'mi',
        calories: row.calories ?? null,
    }));

    return {
        requiresAuth: false,
        viewingUser,
        exercises: exercises.map((e: typeof exercises[number]) => e.name),
        cardioActivities: cardioActivities.map((a) => a.name),
        sets: setEntries,
        cardioSessions,
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

export async function addCardioActivityServer(name: string) {
    const userId = await requireMe();
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) throw new Error('Activity name required');

    const existing = await db.cardioActivityEntry.findFirst({
        where: { userId, name: trimmed },
        select: { id: true, name: true },
    });
    if (existing) return existing;

    return db.cardioActivityEntry.create({
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

export async function addCardioSessionServer(input: {
    activity: CardioMode;
    timeMinutes: number;
    distance?: number;
    distanceUnit: DistanceUnit;
    calories?: number;
    date: string; // YYYY-MM-DD
}) {
    const userId = await requireMe();
    const activityName = input.activity.trim().toLowerCase();
    if (!activityName) {
        throw new Error('Activity name is required');
    }
    const timeMinutes = Math.max(0, Math.round(input.timeMinutes));
    if (timeMinutes <= 0) {
        throw new Error('Time in minutes is required');
    }

    let activity = await db.cardioActivityEntry.findFirst({
        where: { userId, name: activityName },
        select: { id: true, name: true },
    });
    if (!activity) {
        activity = await db.cardioActivityEntry.create({
            data: { userId, name: activityName },
            select: { id: true, name: true },
        });
    }

    const distanceValue =
        typeof input.distance === 'number' && Number.isFinite(input.distance) ? input.distance : null;
    const caloriesValue =
        typeof input.calories === 'number' && Number.isFinite(input.calories)
            ? Math.max(0, Math.round(input.calories))
            : null;

    const created = await db.cardioSession.create({
        data: {
            userId,
            activityId: activity.id,
            timeMinutes,
            distance: distanceValue,
            distanceUnit: input.distanceUnit,
            calories: caloriesValue,
            date: new Date(input.date),
        },
        select: {
            id: true,
            activity: { select: { name: true } },
            date: true,
            timeMinutes: true,
            distance: true,
            distanceUnit: true,
            calories: true,
        },
    });

    const result: CardioSessionEntry = {
        id: created.id,
        activity: created.activity?.name ?? activityName,
        date: created.date.toISOString().slice(0, 10),
        timeMinutes: created.timeMinutes,
        distance: created.distance ?? null,
        distanceUnit: (created.distanceUnit as DistanceUnit) ?? 'mi',
        calories: created.calories ?? null,
    };

    return result;
}

export async function deleteCardioSessionServer(id: string) {
    const userId = await requireMe();
    const found = await db.cardioSession.findFirst({
        where: { id, userId },
        select: { id: true },
    });
    if (!found) {
        return { deleted: false };
    }
    await db.cardioSession.delete({ where: { id } });
    return { deleted: true };
}

/** Persistently delete an exercise (and its sets) for the current user */
export async function deleteExerciseServer(name: string) {
    const userId = await requireMe();
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) throw new Error('Exercise name required');

    // Find exercise for this user
    const exercise = await db.workoutExercise.findFirst({
        where: { userId, name: trimmed },
        select: { id: true },
    });

    if (!exercise) {
        return { deleted: false };
    }

    // Delete all sets tied to this exercise (to avoid FK issues)
    await db.workoutSet.deleteMany({
        where: {
            userId,
            exerciseId: exercise.id,
        },
    });

    // Delete the exercise itself
    await db.workoutExercise.delete({
        where: { id: exercise.id },
    });

    return { deleted: true };
}

export async function deleteCardioActivityServer(name: string) {
    const userId = await requireMe();
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) throw new Error('Activity name required');

    const activity = await db.cardioActivityEntry.findFirst({
        where: { userId, name: trimmed },
        select: { id: true },
    });

    if (!activity) {
        return { deleted: false };
    }

    await db.cardioSession.deleteMany({
        where: { userId, activityId: activity.id },
    });

    await db.cardioActivityEntry.delete({
        where: { id: activity.id },
    });

    return { deleted: true };
}
