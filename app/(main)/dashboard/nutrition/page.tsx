'use client';

import Link from 'next/link';
import MobileHeader from '@/components/MobileHeader';
import { useMemo, useRef, useState, useEffect, useCallback, Suspense } from 'react';
import type { Dispatch, SetStateAction, CSSProperties } from 'react';
import { Plus, X, Trash2, ArrowUpRight, ArrowDownRight, Sliders, Calendar, Share2, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { HEATMAP_COLORS_DARK, HEATMAP_COLORS_LIGHT } from '@/lib/heatmapColors';

import {
    fetchAllNutritionData,
    addNutritionEntryServer,
    deleteNutritionEntryServer,
    upsertBodyweightServer,
    deleteBodyweightEntryServer,
    saveCustomFoodServer,
    deleteCustomFoodServer,
    saveMacroGoalsServer,
    saveHeatmapLevelsServer,
    type NutritionEntryDTO,
    type BodyweightDTO,
    type CustomFoodDTO,
} from '@/components/nutritionActions';

/** ---------- shared helpers ---------- */
function fmtDate(d: Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function average(nums: number[]) { if (!nums.length) return 0; return nums.reduce((a, b) => a + b, 0) / nums.length; }

/** Small hook for responsive components */
function useMeasure<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
        if (!ref.current) return;
        const el = ref.current;
        const ro = new ResizeObserver((entries) => {
            const cr = entries[0]?.contentRect;
            if (cr) setSize({ width: cr.width, height: cr.height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return { ref, ...size };
}

function useIsCoarsePointer() {
    const [isCoarse, setIsCoarse] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(pointer: coarse)');
        const update = () => setIsCoarse(mq.matches);
        update();
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', update);
            return () => mq.removeEventListener('change', update);
        }
        mq.addListener(update);
        return () => mq.removeListener(update);
    }, []);
    return isCoarse;
}

/** ---------- types ---------- */
type Macro = { kcal: number; p: number; f: number; c: number };
type Food = { id: string; name: string; macros: Macro };
type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type BWPoint = { date: string; weight: number };
type RangeKey = '1W' | '1M' | '3M' | '1Y' | 'ALL';
type Metric = 'kcal' | 'p' | 'c' | 'f';
type HMMetric = 'kcal' | 'f' | 'c' | 'p';
type ShareUserInfo = { id: string; username: string | null; name: string | null; image?: string | null };
type ShareOutgoingEntry = { viewer: ShareUserInfo; workouts: boolean; wellness: boolean; nutrition: boolean };
type ShareIncomingEntry = { owner: ShareUserInfo; workouts: boolean; wellness: boolean; nutrition: boolean };

const shareDisplayName = (user: ShareUserInfo) =>
    (user.name && user.name.trim()) || (user.username && user.username.trim()) || 'User';

/** Demo foods (static baseline options) */
const FOOD_DB: Food[] = [
    { id: '1', name: 'Grilled chicken (100g)', macros: { kcal: 165, p: 31, f: 3.6, c: 0 } },
    { id: '2', name: 'White rice (1 cup)', macros: { kcal: 205, p: 4.3, f: 0.4, c: 44.5 } },
    { id: '3', name: 'Avocado (1/2)', macros: { kcal: 120, p: 1.5, f: 11, c: 6 } },
    { id: '4', name: 'Greek yogurt (170g)', macros: { kcal: 100, p: 17, f: 0, c: 6 } },
    { id: '5', name: 'Oats (1/2 cup)', macros: { kcal: 150, p: 5, f: 3, c: 27 } },
];

/** Defaults for heatmap thresholds */
const DEFAULT_LEVELS: Record<HMMetric, number[]> = {
    kcal: [0, 2200, 2600, 3000, Infinity],
    f: [0, 20, 40, 60, Infinity],
    c: [0, 60, 120, 180, Infinity],
    p: [0, 50, 100, 150, Infinity],
};
/** ---------- page ---------- */
function NutritionContent() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const heatmapColors = isDark ? HEATMAP_COLORS_DARK : HEATMAP_COLORS_LIGHT;
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const searchParamsString = searchParams?.toString() ?? '';
    const viewParam = searchParams?.get('view');

    /** Macro goals (now editable) */
    const [goals, setGoals] = useState<Macro>({ kcal: 2800, p: 200, f: 80, c: 300 });
    const [openEditGoals, setOpenEditGoals] = useState(false);

    /** Heatmap thresholds (now editable) */
    const [heatmapLevels, setHeatmapLevels] = useState<Record<HMMetric, number[]>>({ ...DEFAULT_LEVELS });
    const [openEditLevels, setOpenEditLevels] = useState(false);

    /** Which date are we editing/seeing meals for? */
    const [dateISO, setDateISO] = useState<string>(fmtDate(new Date()));

    /** Persisted nutrition entries & bodyweights (server) */
    const [entries, setEntries] = useState<NutritionEntryDTO[]>([]);
    const [bodyweights, setBodyweights] = useState<BodyweightDTO[]>([]);
    const [customFoods, setCustomFoods] = useState<CustomFoodDTO[]>([]);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const [shareSaving, setShareSaving] = useState<string | null>(null);
    const [shareFollowers, setShareFollowers] = useState<ShareUserInfo[]>([]);
    const [shareOutgoing, setShareOutgoing] = useState<ShareOutgoingEntry[]>([]);
    const [shareIncoming, setShareIncoming] = useState<ShareIncomingEntry[]>([]);
    const [selectedViewUser, setSelectedViewUser] = useState<string | null>(null);
    const [viewingUser, setViewingUser] = useState<ShareUserInfo | null>(null);

    /** Derived “meals for selected date” view */
    const mealsForDate = useMemo<
        { meal: Meal; items: { id?: string; food: Food; servings: number; time?: string }[] }[]
    >(() => {
        const rows = entries.filter((e) => e.date === dateISO);
        const base: { meal: Meal; items: { id?: string; food: Food; servings: number; time?: string }[] }[] = [
            { meal: 'breakfast', items: [] },
            { meal: 'lunch', items: [] },
            { meal: 'dinner', items: [] },
            { meal: 'snack', items: [] },
        ];
        for (const r of rows) {
            const f: Food = {
                id: r.customFoodId || r.foodName,
                name: r.foodName,
                macros: { kcal: r.kcal, p: r.p, f: r.f, c: r.c },
            };
            const row = base.find((b) => b.meal === r.meal)!;
            row.items.push({ id: r.id, food: f, servings: r.servings, time: r.time || '' });
        }
        return base;
    }, [entries, dateISO]);

    /** Add-food UI state (lives inside the macros card) */
    const [q, setQ] = useState('');
    const [serv, setServ] = useState('1');
    const [targetMeal, setTargetMeal] = useState<Meal>('lunch');

    /** Add a food to selected date (persists via server) */
    const addFood = async (food: Food) => {
        const s = Math.max(0.25, parseFloat(serv || '1'));
        const maybeCF = customFoods.find((cf) => cf.id === food.id) || null;

        const payload = {
            date: dateISO,
            meal: targetMeal as Meal,
            foodName: maybeCF ? `${maybeCF.name} (${maybeCF.grams}g)` : food.name,
            servings: s,
            kcal: maybeCF ? maybeCF.kcal : food.macros.kcal,
            p: maybeCF ? maybeCF.p : food.macros.p,
            c: maybeCF ? maybeCF.c : food.macros.c,
            f: maybeCF ? maybeCF.f : food.macros.f,
            time: new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
            customFoodId: maybeCF?.id ?? null,
        };
        try {
            const created = await addNutritionEntryServer(payload);
            setEntries((prev) => [created, ...prev]);
        } catch (e) { console.error(e); }
    };

    /** Remove a single food entry by DB id */
    const removeEntry = async (id?: string) => {
        if (!id) return;
        try {
            const res = await deleteNutritionEntryServer(id);
            if (res.deleted) setEntries((cur) => cur.filter((x) => x.id !== id));
        } catch (e) { console.error(e); }
    };

    /** Totals for selected date */
    const consumed = useMemo(() => {
        const sum: Macro = { kcal: 0, p: 0, f: 0, c: 0 };
        for (const row of mealsForDate) {
            for (const it of row.items) {
                sum.kcal += it.food.macros.kcal * it.servings;
                sum.p += it.food.macros.p * it.servings;
                sum.f += it.food.macros.f * it.servings;
                sum.c += it.food.macros.c * it.servings;
            }
        }
        return {
            kcal: Math.round(sum.kcal),
            p: Math.round(sum.p),
            f: Math.round(sum.f),
            c: Math.round(sum.c),
        };
    }, [mealsForDate]);

    /** Bodyweight data */
    const bw: BWPoint[] = useMemo(
        () =>
            bodyweights
                .map((b) => ({ date: b.date, weight: b.weight }))
                .sort((a, b) => a.date.localeCompare(b.date)),
        [bodyweights]
    );
    const addBw = async (d: string, weight: number) => {
        try {
            const up = await upsertBodyweightServer({ date: d, weight });
            setBodyweights((s) => {
                const rest = s.filter((p) => p.date !== up.date);
                return [...rest, up].sort((a, b) => a.date.localeCompare(b.date));
            });
        } catch (e) {
            console.error(e);
        }
    };
    const deleteBw = async (dateISO: string) => {
        try {
            const res = await deleteBodyweightEntryServer(dateISO);
            if (res.deleted) {
                setBodyweights((prev) => prev.filter((entry) => entry.date !== dateISO));
            }
        } catch (e) {
            console.error(e);
        }
    };

    /** Heatmap: metric state + computed values for selected metric */
    const [heatMetric, setHeatMetric] = useState<HMMetric>('kcal');
    const valuesByDateMetric = useMemo<Record<string, number>>(() => {
        const map: Record<string, number> = {};
        for (const e of entries) {
            const v =
                heatMetric === 'kcal' ? e.kcal :
                    heatMetric === 'f' ? e.f :
                        heatMetric === 'c' ? e.c : e.p;
            map[e.date] = (map[e.date] || 0) + v * e.servings;
        }
        Object.keys(map).forEach((d) => (map[d] = Math.round(map[d])));
        return map;
    }, [entries, heatMetric]);

    useEffect(() => {
        setSelectedViewUser(viewParam && viewParam.length ? viewParam : null);
    }, [viewParam]);

    const handleViewChange = useCallback(
        (value: string | null) => {
            const params = new URLSearchParams(searchParamsString);
            if (value) {
                params.set('view', value);
            } else {
                params.delete('view');
            }
            const qs = params.toString();
            router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
        },
        [pathname, router, searchParamsString],
    );

    /** Load everything from server (supports shared view) */
    useEffect(() => {
        (async () => {
            try {
                const data = await fetchAllNutritionData(selectedViewUser ?? undefined);
                if (data.requiresAuth) {
                    if (selectedViewUser) {
                        handleViewChange(null);
                        return;
                    }
                    router.push('/');
                    return;
                }
                setViewingUser(data.viewingUser ?? null);
                setEntries(data.entries || []);
                setBodyweights(data.bodyweights || []);
                setCustomFoods(data.customFoods || []);
                if (data.settings?.goals) setGoals(data.settings.goals);
                if (data.settings?.heatmapLevels) setHeatmapLevels(data.settings.heatmapLevels);
            } catch (e) {
                console.error(e);
            }
        })();
    }, [handleViewChange, router, selectedViewUser]);

    const refreshShareData = useCallback(async () => {
        try {
            setShareLoading(true);
            setShareError(null);
            const res = await fetch('/api/dashboard-share?followers=1', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to load sharing data');
            const data = await res.json();
            setShareFollowers(data.followers ?? []);
            setShareOutgoing(data.outgoing ?? []);
            setShareIncoming(data.incoming ?? []);
        } catch (err) {
            setShareError('Unable to load sharing data.');
        } finally {
            setShareLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshShareData();
    }, [refreshShareData]);

    const toggleShareForFollower = useCallback(
        async (viewerId: string, enabled: boolean) => {
            try {
                setShareSaving(viewerId);
                setShareError(null);
                const res = await fetch('/api/dashboard-share', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ viewerId, dashboard: 'nutrition', enabled }),
                });
                if (!res.ok) throw new Error('Failed to update sharing');
                await refreshShareData();
            } catch (err) {
                setShareError('Failed to update sharing permissions.');
            } finally {
                setShareSaving(null);
            }
        },
        [refreshShareData],
    );

    const removeIncomingShare = useCallback(
        async (ownerId: string) => {
            try {
                setShareSaving(ownerId);
                const res = await fetch('/api/dashboard-share', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ownerId }),
                });
                if (!res.ok) throw new Error('Failed to remove share');
                if (selectedViewUser === ownerId) {
                    handleViewChange(null);
                }
                await refreshShareData();
            } catch (err) {
                setShareError('Failed to remove shared dashboard.');
            } finally {
                setShareSaving(null);
            }
        },
        [handleViewChange, refreshShareData, selectedViewUser],
    );

    const availableIncoming = useMemo(
        () => shareIncoming.filter((entry) => entry.nutrition),
        [shareIncoming],
    );

    useEffect(() => {
        if (!selectedViewUser) return;
        const exists = availableIncoming.some((entry) => entry.owner.id === selectedViewUser);
        if (!exists && viewParam) {
            handleViewChange(null);
        }
    }, [availableIncoming, handleViewChange, selectedViewUser, viewParam]);

    const shareOutgoingMap = useMemo(() => {
        const map = new Map<string, ShareOutgoingEntry>();
        shareOutgoing.forEach((entry) => map.set(entry.viewer.id, entry));
        return map;
    }, [shareOutgoing]);

    const renderShareControls = useCallback(
        (variant: 'mobile' | 'desktop') => (
            <div
                className={clsx(
                    'flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300',
                    variant === 'mobile' ? 'w-full flex-wrap' : '',
                )}
            >
                <button
                    onClick={() => setShareModalOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition hover:bg-zinc-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                    aria-label="Share nutrition dashboard"
                >
                    <Share2 size={18} />
                </button>
                <div
                    className={clsx(
                        'flex items-center gap-2',
                        variant === 'mobile' ? 'min-w-[200px] flex-1' : 'w-[240px]',
                    )}
                >
                    <div className="relative flex-1">
                        <select
                            value={selectedViewUser ?? ''}
                            onChange={(e) => handleViewChange(e.target.value || null)}
                            className="w-full h-10 appearance-none rounded-full border border-zinc-200 bg-white px-3 pr-10 text-sm leading-tight focus:outline-none focus:ring-0 focus:border-zinc-400 hover:border-zinc-400 dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-white/40 dark:hover:border-white/30"
                        >
                            <option value="">My stats</option>
                            {availableIncoming.map((entry) => (
                                <option key={entry.owner.id} value={entry.owner.id}>
                                    {shareDisplayName(entry.owner)}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-white/80" />
                    </div>
                    {selectedViewUser && (
                        <button
                            onClick={() => removeIncomingShare(selectedViewUser)}
                            disabled={shareSaving === selectedViewUser}
                            className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-400/10"
                        >
                            Remove
                        </button>
                    )}
                </div>
                {selectedViewUser && variant === 'desktop' && viewingUser && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Viewing {shareDisplayName(viewingUser)}
                    </p>
                )}
            </div>
        ),
        [availableIncoming, handleViewChange, removeIncomingShare, selectedViewUser, shareSaving, viewingUser],
    );

    const handleSaveGoals = async (next: Macro) => {
        try {
            await saveMacroGoalsServer(next);
            setGoals(next);
            setOpenEditGoals(false);
        } catch (e) {
            console.error(e);
            alert('Failed to save macro goals. Please try again.');
        }
    };

    const handleSaveHeatmap = async (next: Record<HMMetric, number[]>) => {
        try {
            const saved = await saveHeatmapLevelsServer(next);
            setHeatmapLevels(saved);
            setOpenEditLevels(false);
        } catch (e) {
            console.error(e);
            alert('Failed to save heatmap keys. Please try again.');
        }
    };

    /** Layout */
    const selectedTabClass =
        "flex-1 rounded-2xl border border-zinc-900 bg-zinc-900 px-4 py-2 text-center font-medium text-white dark:border-white dark:bg-white/10";
    const unselectedTabClass =
        "flex-1 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-2 text-center font-medium text-zinc-600 transition hover:border-zinc-400 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/30";

    const mobileTabs = (
        <div className="px-4 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
                {renderShareControls('mobile')}
                <div className="flex flex-1 gap-2 text-sm">
                    <Link href="/dashboard" className={unselectedTabClass}>
                        workouts
                    </Link>
                    <Link href="/dashboard/wellness" className={unselectedTabClass}>
                        wellness
                    </Link>
                    <Link href="/dashboard/nutrition" className={selectedTabClass}>
                        nutrition
                    </Link>
                </div>
            </div>
            {shareError && (
                <p className="mt-2 text-xs text-red-500">{shareError}</p>
            )}
        </div>
    );

    return (
        <>
        <div className="flex min-h-screen flex-col bg-[#f8f8f8] text-black dark:bg-[#050505] dark:text-white xl:h-screen xl:overflow-hidden">
            <MobileHeader title="nutrition log" href="/dashboard/nutrition" subContent={mobileTabs} />

            {/* Header */}
            <header className="hidden lg:flex w-full flex-none items-center justify-between bg-white px-[40px] py-5 dark:bg-neutral-900 dark:border-b dark:border-white/10">
                <h1 className="select-none font-roboto text-3xl text-green-700 tracking-tight dark:text-green-400">nutrition log</h1>
                <div className="flex flex-1 flex-wrap items-center justify-end gap-4">
                    {renderShareControls('desktop')}
                    <nav className="flex gap-2 text-sm">
                        <Link
                            href="/dashboard"
                            className="rounded-full border border-zinc-200 px-6 py-2 font-medium text-zinc-600 transition hover:border-zinc-400 dark:bg-white/5 dark:border-white/20 dark:text-gray-200 dark:hover:border-white/40"
                        >
                            workouts
                        </Link>
                        <Link
                            href="/dashboard/wellness"
                            className="rounded-full border border-zinc-200 px-6 py-2 font-medium text-zinc-600 transition hover:border-zinc-400 dark:bg-white/5 dark:border-white/20 dark:text-gray-200 dark:hover:border-white/40"
                        >
                            wellness
                        </Link>
                        <Link
                            href="/dashboard/nutrition"
                            className="rounded-full bg-black border border-zinc-200 px-6 py-2 font-medium text-white transition dark:bg-white/10 dark:border-white-b/60 dark:text-gray-200"
                        >
                            nutrition
                        </Link>
                    </nav>
                </div>
            </header>
            {shareError && (
                <p className="hidden px-[40px] pb-2 text-xs text-red-500 lg:block">{shareError}</p>
            )}

            {/* Content */}
            <div className="w-full flex-1 overflow-y-auto overflow-x-hidden px-2 pb-6 pt-4 sm:px-4 xl:px-6 xl:pb-4 xl:pt-4 xl:overflow-y-auto scrollbar-slim">
                <div className="mx-auto flex w-full max-w-[375px] flex-col gap-6 xl:max-w-[1400px] xl:grid xl:min-h-[820px] xl:h-full xl:min-w-0 xl:grid-cols-12">
                    {/* LEFT — Macros flip card (with date switcher) */}
                    <section className="col-span-12 min-h-0 xl:col-span-4 xl:flex xl:flex-col">
                        <div className="mx-auto w-full max-w-[375px] xl:max-w-none xl:flex-1">
                            <MacrosFlipCard
                                dateISO={dateISO}
                                onDateChange={setDateISO}
                                goals={goals}
                                consumed={consumed}
                                meals={mealsForDate}
                                onEditGoals={() => setOpenEditGoals(true)}
                                addUI={{ q, setQ, serv, setServ, targetMeal, setTargetMeal, addFood, customFoods, setCustomFoods }}
                            />
                        </div>
                    </section>

                    {/* MIDDLE — Bodyweight + Heatmap */}
                    <section className="col-span-12 min-h-0 xl:col-span-5 xl:flex xl:flex-col gap-3">
                        <div className="mx-auto flex w-full max-w-[375px] flex-col gap-3 xl:flex-1 xl:max-w-none">
                            <div className="relative min-h-[320px] rounded-xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none xl:flex-1">
                                <BWChartLiftsStyle
                                    points={bw}
                                    onAdd={(d, w) => addBw(d, w)}
                                    onDelete={deleteBw}
                                    isDark={isDark}
                                />
                            </div>

                            <div className="relative min-h-[220px] flex flex-col rounded-xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none xl:flex-1">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">
                                            {new Date().getFullYear()} {heatMetric === 'kcal' ? 'calories' : heatMetric === 'f' ? 'fat' : heatMetric === 'c' ? 'carbs' : 'protein'}
                                        </h3>
                                        <div className="text-[11px] text-zinc-500">
                                            {heatMetric === 'kcal' ? 'kcal per day' : 'g per day'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setOpenEditLevels(true)}
                                        className="inline-flex flex-shrink-0 items-center rounded-md border p-2 text-xs hover:bg-zinc-50 dark:hover:bg-white/10"
                                        title="Edit heatmap keys"
                                    >
                                        <Sliders size={14} />
                                    </button>
                                </div>
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    {(['kcal', 'f', 'c', 'p'] as HMMetric[]).map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => setHeatMetric(m)}
                                            className={`rounded-md px-2 py-1 text-xs capitalize ${
                                                heatMetric === m
                                                    ? 'bg-black text-white dark:bg-white dark:text-black'
                                                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10'
                                            }`}
                                            title={m === 'kcal' ? 'Calories' : m === 'f' ? 'Fat' : m === 'c' ? 'Carbs' : 'Protein'}
                                        >
                                            {m === 'kcal' ? 'kcal' : m === 'f' ? 'fat' : m === 'c' ? 'carbs' : 'protein'}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex flex-1 items-center justify-center">
                                    <div className="flex h-[200px] w-full max-w-[375px] items-center justify-center xl:h-[180px] xl:max-w-[540px]">
                                        <ResponsiveHeatmap
                                            valuesByDate={valuesByDateMetric}
                                            height={140}
                                            showAlternateDays
                                            levels={heatmapLevels[heatMetric]}
                                            colors={heatmapColors}
                                            isDark={isDark}
                                        />
                                    </div>
                                </div>

                                <div className="mt-1 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-[11px] text-zinc-600 dark:text-zinc-300">
                                    <HeatmapLegend metric={heatMetric} levels={heatmapLevels[heatMetric]} colors={heatmapColors} isDark={isDark} />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* RIGHT — Meals for selected date */}
                    <section className="col-span-12 min-h-0 xl:col-span-3 xl:flex xl:flex-col">
                        <div className="mx-auto flex w-full max-w-[375px] flex-col xl:flex-1 xl:max-w-none">
                            <div className="min-h-0 flex-1 rounded-xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none">
                                <div className="mb-2 flex items-center justify-between">
                                    <h3 className="font-semibold">
                                        Meals
                                    </h3>
                                    <input
                                        type="date"
                                        value={dateISO}
                                        onChange={(e) => setDateISO(e.target.value)}
                                        className="h-7 rounded-md border px-2 text-xs outline-none"
                                        aria-label="Change date"
                                    />
                                </div>

                                <div className="space-y-3 overflow-y-auto pr-1 max-h-96 xl:h-[calc(100%-36px)] xl:max-h-none">
                                    {mealsForDate.map((row) => (
                                        <div key={row.meal}>
                                            <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                                                {row.meal}
                                            </div>
                                            <ul className="space-y-1">
                                                {row.items.length === 0 ? (
                                                    <li className="text-sm text-zinc-400">—</li>
                                                ) : (
                                                    row.items.map((it) => (
                                                        <li key={it.id} className="flex items-center gap-2 text-sm">
                                                            <span className="min-w-0 flex-1 truncate">{it.food.name}</span>
                                                            <span className="flex flex-shrink-0 items-center gap-3 whitespace-nowrap text-zinc-500">
                                                                <span>
                                                                    {it.servings}× • {(it.food.macros.kcal * it.servings) | 0} kcal
                                                                </span>
                                                                <button
                                                                    aria-label="Delete"
                                                                    className="p-1 text-zinc-500 hover:text-red-600"
                                                                    onClick={() => removeEntry(it.id)}
                                                                    title="Remove"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </span>
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
            </div>

            {/* Modals */}
            {openEditGoals && (
                <EditGoalsModal
                    initial={goals}
                    onClose={() => setOpenEditGoals(false)}
                    onSave={handleSaveGoals}
                />
            )}
            {openEditLevels && (
                <EditLevelsModal
                    initial={heatmapLevels}
                    onClose={() => setOpenEditLevels(false)}
                    onSave={handleSaveHeatmap}
                />
            )}
        </div>
        {shareModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
                <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-neutral-900">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Share nutrition dashboard</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Select followers to grant or revoke access to your nutrition dashboard.
                            </p>
                        </div>
                        <button
                            onClick={() => setShareModalOpen(false)}
                            className="rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10"
                        >
                            Close
                        </button>
                    </div>

                    {shareLoading ? (
                        <div className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-300">Loading followers…</div>
                    ) : shareFollowers.length === 0 ? (
                        <div className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-300">
                            No followers to share with yet.
                        </div>
                    ) : (
                        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                            {shareFollowers.map((follower) => {
                                const outgoing = shareOutgoingMap.get(follower.id);
                                const granted = !!outgoing?.nutrition;
                                return (
                                    <div
                                        key={follower.id}
                                        className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 dark:border-white/15"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                                {shareDisplayName(follower)}
                                            </p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                {granted ? 'Access granted' : 'Not shared'}
                                            </p>
                                        </div>
                                        <button
                                            disabled={shareSaving === follower.id}
                                            onClick={() => toggleShareForFollower(follower.id, !granted)}
                                            className={clsx(
                                                'rounded-full px-4 py-1.5 text-sm font-medium transition',
                                                granted
                                                    ? 'border border-red-400 text-red-600 hover:bg-red-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-400/10'
                                                    : 'border border-green-400 text-green-600 hover:bg-green-50 dark:border-green-500/40 dark:text-green-300 dark:hover:bg-green-500/10',
                                                shareSaving === follower.id && 'opacity-50',
                                            )}
                                        >
                                            {shareSaving === follower.id
                                                ? 'Saving…'
                                                : granted
                                                    ? 'Stop sharing'
                                                    : 'Share'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {shareError && (
                        <p className="mt-4 text-sm text-red-500">{shareError}</p>
                    )}
                </div>
            </div>
        )}
        </>
    );
}

export default function Nutrition() {
    return (
        <Suspense fallback={<div className="p-8 text-gray-500 dark:text-gray-300">Loading…</div>}>
            <NutritionContent />
        </Suspense>
    );
}

/** ---------- Flip card (Macros ↔ Add food) ---------- */
function MacrosFlipCard({
    dateISO,
    onDateChange,
    goals,
    consumed,
    meals,
    onEditGoals,
    addUI,
}: {
    dateISO: string;
    onDateChange: (d: string) => void;
    goals: Macro;
    consumed: Macro;
    meals: { meal: Meal; items: { food: Food; servings: number; time?: string }[] }[];
    onEditGoals: () => void;
    addUI: {
        q: string;
        setQ: (v: string) => void;
        serv: string;
        setServ: (v: string) => void;
        targetMeal: Meal;
        setTargetMeal: (m: Meal) => void;
        addFood: (food: Food) => void;
        customFoods: CustomFoodDTO[];
        setCustomFoods: Dispatch<SetStateAction<CustomFoodDTO[]>>;
    };
}) {
    const [flipped, setFlipped] = useState(false);

    return (
        <div className="rounded-xl border bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none [perspective:1200px] overflow-hidden xl:h-full">
            {/* toolbar */}
            <div className="flex flex-nowrap items-center gap-3 px-4 pt-4 text-sm overflow-x-auto">
                <h3 className="whitespace-nowrap font-semibold">Macros</h3>
                <input
                    type="date"
                    value={dateISO}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="h-7 w-[130px] flex-shrink-0 rounded-md border px-2 text-xs outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                    aria-label="Change date"
                />
                <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={onEditGoals}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs hover:bg-zinc-50 dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10"
                        title="Edit macro goals"
                        aria-label="Edit macro goals"
                    >
                        <Sliders size={14} />
                    </button>
                    <button
                        aria-label={flipped ? 'Close add food' : 'Add food'}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                            flipped ? 'bg-neutral-200 text-black dark:bg-white/20 dark:text-white' : 'bg-black text-white dark:bg-white dark:text-black'
                        } hover:opacity-90`}
                        onClick={() => setFlipped((v) => !v)}
                        title={flipped ? 'Close' : 'Add food'}
                    >
                        {flipped ? <X size={16} /> : <Plus size={16} />}
                    </button>
                </div>
            </div>

            {/* flip container */}
            <div
                className={`relative h-[500px] w-full transition-transform duration-300 [transform-style:preserve-3d] xl:h-[calc(100%-48px)] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
            >
                {/* FRONT — rings + Edit button (bottom-right) */}
                <div className="absolute inset-0 backface-hidden p-4">
                    <div className="relative flex h-full items-center justify-center">
                        <div className="grid w-full max-w-[375px] grid-cols-2 place-items-center gap-3 md:gap-2">
                            <RingBig label="calories (kcal)" value={consumed.kcal} goal={goals.kcal} color="#ef4444" />
                            <RingBig label="protein (g)" value={consumed.p} goal={goals.p} color="#6cf542" />
                            <RingBig label="fat (g)" value={consumed.f} goal={goals.f} color="#f5e642" />
                            <RingBig label="carbs (g)" value={consumed.c} goal={goals.c} color="#3b82f6" />
                        </div>

                    </div>
                </div>

                {/* BACK — Add food */}
                <div className="absolute inset-0 overflow-hidden rounded-3xl p-4 [transform:rotateY(180deg)] backface-hidden dark:bg-neutral-900">
                    <AddFoodPanel meals={meals} {...addUI} />
                </div>
            </div>
        </div>
    );
}

/** Rings */
function RingBig({ label, value, goal, color }: { label: string; value: number; goal: number; color: string; }) {
    const pct = Math.min(1, value / Math.max(1, goal));
    const R = 90; const C = 2 * Math.PI * R;
    return (
        <div className="relative flex items-center justify-center bg-white p-0.5 sm:p-2 dark:bg-transparent">
            <svg viewBox="0 0 240 240" className="aspect-square w-full max-w-[220px]">
                <circle cx="120" cy="120" r={R} stroke="#e5e7eb" strokeWidth="10" fill="none" strokeLinecap="round" className="dark:stroke-white/10" />
                <circle cx="120" cy="120" r={R} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={`${C * pct},999`} transform="rotate(-90 120 120)" />
            </svg>
            <div className="absolute text-center">
                <div className="text-base md:text-base font-semibold">{value} / {goal}</div>
                <div className="text-xs md:text-xs text-neutral-500 dark:text-neutral-300">{label}</div>
            </div>
        </div>
    );
}

/** Back face: Add food with custom food creator */
const HIDDEN_PRESETS_KEY = 'nutrition_hidden_presets';

function AddFoodPanel({
    q, setQ, serv, setServ, targetMeal, setTargetMeal, addFood, meals, customFoods, setCustomFoods,
}: {
    q: string; setQ: (v: string) => void;
    serv: string; setServ: (v: string) => void;
    targetMeal: Meal; setTargetMeal: (m: Meal) => void;
    addFood: (food: Food) => void;
    meals: { meal: Meal; items: { food: Food; servings: number; time?: string }[] }[];
    customFoods: CustomFoodDTO[];
    setCustomFoods: Dispatch<SetStateAction<CustomFoodDTO[]>>;
}) {
    const [metric, setMetric] = useState<Metric>('kcal');
    const [cf, setCf] = useState({ name: '', grams: '', kcal: '', p: '', c: '', f: '' });
    const [showCustom, setShowCustom] = useState(false);
    const [hiddenPresets, setHiddenPresets] = useState<string[]>([]);
    const [presetsLoaded, setPresetsLoaded] = useState(false);

    const fieldCls = 'h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-white/20 dark:bg-transparent dark:text-gray-100';

    const addCustomFood = async () => {
        const kcal = parseFloat(cf.kcal);
        const p = parseFloat(cf.p);
        const c = parseFloat(cf.c);
        const f = parseFloat(cf.f);
        const grams = parseFloat(cf.grams);
        if (!cf.name || !isFinite(kcal) || !isFinite(p) || !isFinite(c) || !isFinite(f) || !isFinite(grams)) return;

        try {
            const created = await saveCustomFoodServer({ name: cf.name, grams, kcal, p, c, f });
            setCustomFoods([created, ...customFoods]);
            setCf({ name: '', grams: '', kcal: '', p: '', c: '', f: '' });
            setShowCustom(false);
        } catch (e) { console.error(e); }
    };

    const unitLabel = metric === 'kcal' ? 'kcal' : metric === 'p' ? 'g protein' : metric === 'c' ? 'g carbs' : 'g fat';

    const presetIds = useMemo(() => new Set(FOOD_DB.map((f) => f.id)), []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const stored = window.localStorage.getItem(HIDDEN_PRESETS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setHiddenPresets(parsed.filter((id) => typeof id === 'string'));
                    setPresetsLoaded(true);
                    return;
                }
            }
        } catch {
            // ignore parse errors
        }
        setPresetsLoaded(true);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !presetsLoaded) return;
        try {
            window.localStorage.setItem(HIDDEN_PRESETS_KEY, JSON.stringify(hiddenPresets));
        } catch {
            // ignore storage errors
        }
    }, [hiddenPresets, presetsLoaded]);

    const customFoodAsFood: Food[] = customFoods.map((cf) => ({
        id: cf.id,
        name: `${cf.name} (${cf.grams}g)`,
        macros: { kcal: cf.kcal, p: cf.p, c: cf.c, f: cf.f },
    }));

    const presetFoods = presetsLoaded
        ? FOOD_DB.filter((f) => !hiddenPresets.includes(f.id))
        : [];

    const list = [...customFoodAsFood, ...presetFoods].filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));

    const removeFood = async (id: string) => {
        if (presetIds.has(id)) {
            setHiddenPresets((prev) => (prev.includes(id) ? prev : [...prev, id]));
            return;
        }
        try {
            const res = await deleteCustomFoodServer(id);
            if (res.deleted) {
                setCustomFoods((prev) => prev.filter((cf) => cf.id !== id));
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="flex h-full flex-col">
            {/* search + target + servings */}
            <div className="grid grid-cols-3 gap-2">
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search foods…"
                    className={`${fieldCls} w-full`}
                />
                <select
                    className={`${fieldCls} w-full appearance-none pr-8`}
                    value={targetMeal}
                    onChange={(e) => setTargetMeal(e.target.value as Meal)}
                    style={{
                        backgroundImage:
                            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center',
                        backgroundSize: '16px 16px',
                    }}
                >
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>

                <input
                    type="number"
                    min={0.25}
                    step="0.25"
                    value={serv}
                    onChange={(e) => setServ(e.target.value)}
                    className={`${fieldCls} w-full text-right`}
                    placeholder="serv"
                    inputMode="decimal"
                />
            </div>

            {/* Toggle button */}
            <div className="mt-3">
                <button
                    type="button"
                    aria-expanded={showCustom}
                    aria-controls="custom-food-panel"
                    onClick={() => setShowCustom((v) => !v)}
                    className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm hover:bg-zinc-50 dark:hover:bg-white/10"
                >
                    {showCustom ? <X size={16} /> : <Plus size={16} />}
                    {showCustom ? 'Close custom food' : 'Add custom food'}
                </button>
            </div>

            {/* Collapsible custom food form */}
            <div id="custom-food-panel" className={`mt-2 overflow-hidden rounded-lg border transition-all duration-300 dark:border-white/20 dark:bg-neutral-900/50 ${showCustom ? 'max-h-[420px] opacity-100 p-3' : 'max-h-0 opacity-0 p-0'}`}>
                <div className="grid grid-cols-12 gap-2">
                    <input className={`${fieldCls} col-span-12 md:col-span-6`} placeholder="Name" value={cf.name} onChange={(e) => setCf((s) => ({ ...s, name: e.target.value }))} />
                    <input className={`${fieldCls} col-span-6 md:col-span-3`} placeholder="Grams" inputMode="numeric" value={cf.grams} onChange={(e) => setCf((s) => ({ ...s, grams: e.target.value }))} />
                    <input className={`${fieldCls} col-span-6 md:col-span-3`} placeholder="Calories" inputMode="numeric" value={cf.kcal} onChange={(e) => setCf((s) => ({ ...s, kcal: e.target.value }))} />
                    <input className={`${fieldCls} col-span-4 md:col-span-3`} placeholder="Protein" inputMode="numeric" value={cf.p} onChange={(e) => setCf((s) => ({ ...s, p: e.target.value }))} />
                    <input className={`${fieldCls} col-span-4 md:col-span-3`} placeholder="Carbs" inputMode="numeric" value={cf.c} onChange={(e) => setCf((s) => ({ ...s, c: e.target.value }))} />
                    <input className={`${fieldCls} col-span-4 md:col-span-3`} placeholder="Fat" inputMode="numeric" value={cf.f} onChange={(e) => setCf((s) => ({ ...s, f: e.target.value }))} />
                    <div className="col-span-4 md:col-span-3 flex items-center">
                        <button className="h-10 w-full border rounded-md bg-black px-4 text-sm text-white dark:border-white/20 dark:bg-neutral-900 dark:hover:bg-white/10" onClick={addCustomFood}>Save</button>
                    </div>
                </div>
            </div>

            {/* list */}
            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border dark:border-white/20">
                <ul className="divide-y dark:divide-white/10">
                    {list.map((f) => {
                        const isCustom = customFoods.some((cf) => cf.id === f.id);
                        return (
                            <li key={f.id} className="flex items-center justify-between p-3">
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{f.name}</div>
                                    <div className="text-xs text-zinc-500">{f.macros.kcal} kcal • P {f.macros.p} • C {f.macros.c} • F {f.macros.f}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="rounded-full border p-2 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/10 dark:text-gray-500 dark:hover:text-red-500"
                                        onClick={() => removeFood(f.id)}
                                        title={isCustom || presetIds.has(f.id) ? 'Delete food' : 'Delete'}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <button className="rounded-full border p-2 hover:bg-zinc-50 dark:hover:bg-white/10 dark:text-gray-500 dark:hover:text-white" onClick={() => addFood(f)} title="Add">
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* metric toggle + per-meal tiles */}
            <div className="mt-3">
            <div className="mb-2 inline-flex rounded-lg border bg-white p-1 text-sm dark:border-white/20 dark:bg-white/10">
                    {(['kcal', 'p', 'c', 'f'] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setMetric(m)}
                            className={`rounded-md px-3 py-1 capitalize ${
                                metric === m
                                    ? 'bg-black text-white dark:bg-white dark:text-black'
                                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10'
                            }`}
                            title={m === 'kcal' ? 'Calories' : m === 'p' ? 'Protein' : m === 'c' ? 'Carbs' : 'Fat'}
                        >
                            {m === 'kcal' ? 'kcal' : m === 'p' ? 'protein' : m === 'c' ? 'carbs' : 'fat'}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-[12px]">
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
                        <div key={m} className="rounded border bg-white px-2 py-1 dark:border-white/20 dark:bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-300">{m}</div>
                            <div className="text-zinc-700 dark:text-white">{mealMetric(m, meals as any, metric)} {unitLabel}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** ---------- Bodyweight chart with delta indicator + unit slider ---------- */
function BWChartLiftsStyle({
    points,
    onAdd,
    onDelete,
    isDark = false,
}: {
    points: BWPoint[];
    onAdd: (dateISO: string, weight: number) => void;
    onDelete?: (dateISO: string) => Promise<void> | void;
    isDark?: boolean;
}) {
    const [range, setRange] = useState<RangeKey>('1W');
    const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
    const { ref: chartRef, width: measuredWidth } = useMeasure<HTMLDivElement>();

    const fallbackWidth = 375;
    const effectiveWidth = measuredWidth > 0 ? measuredWidth : fallbackWidth;
    const isMobile = measuredWidth > 0 ? measuredWidth < 640 : true;
    const svgW = isMobile ? effectiveWidth : Math.min(effectiveWidth || 770, 770);
    const svgH = isMobile ? 260 : 280;

    const LBS_PER_KG = 2.20462262185;
    const toDisplay = (vLbs: number) => unit === 'kg' ? vLbs / LBS_PER_KG : vLbs;
    const fmtUnit = unit;
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const innerGrid = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';
    const labelColor = isDark ? '#d1d5db' : '#6b7280';
    const hoverLineColor = isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb';
    const hoverDotFill = isDark ? '#0f172a' : '#ffffff';
    const lineColor = '#16a34a';

    const labels = useMemo(() => {
        if (range === 'ALL') {
            if (!points.length) return [];
            const minD = points[0]!.date;
            const maxD = points[points.length - 1]!.date;
            const start = new Date(minD);
            const end = new Date(maxD);
            const out: string[] = [];
            const cur = new Date(start);
            while (cur <= end) {
                out.push(fmtDate(cur));
                cur.setDate(cur.getDate() + 1);
            }
            return out;
        }
        const n = range === '1W' ? 7 : range === '1M' ? 30 : range === '3M' ? 90 : 365;
        return Array.from({ length: n }).map((_, i) => fmtDate(daysAgo(n - 1 - i)));
    }, [range, points]);

    const byDate: Record<string, number[]> = useMemo(() => {
        const map: Record<string, number[]> = {};
        for (const p of points) (map[p.date] ||= []).push(p.weight);
        return map;
    }, [points]);

    const rawSeries = useMemo(
        () =>
            labels.map((d) => {
                const vals = byDate[d] || [];
                return vals.length ? average(vals) : 0;
            }),
        [labels, byDate]
    );
    const series = useMemo(() => rawSeries.map(v => v > 0 ? toDisplay(v) : 0), [rawSeries, unit]);

    const allWeights = useMemo(() => {
        const arr = points.map((p) => toDisplay(p.weight));
        return arr.filter((v) => Number.isFinite(v) && v > 0);
    }, [points, unit]);

    const globalRange = useMemo(() => {
        if (allWeights.length === 0) return { min: 0, max: 1 };
        let min = Math.min(...allWeights);
        let max = Math.max(...allWeights);
        if (min === max) {
            min -= 1;
            max += 1;
        }
        return { min, max };
    }, [allWeights]);

    // Delta over visible range (in display units)
    const delta = useMemo(() => {
        if (!series.length) return null as null | { diff: number; from?: number; to?: number };
        const firstIdx = series.findIndex((v) => v > 0);
        let lastIdx = -1;
        for (let i = series.length - 1; i >= 0; i--) if (series[i] > 0) { lastIdx = i; break; }
        if (firstIdx === -1 || lastIdx === -1 || lastIdx <= firstIdx) return null;
        const from = series[firstIdx]!;
        const to = series[lastIdx]!;
        return { diff: Number((to - from).toFixed(1)), from, to };
    }, [series]);

    const left = 40, right = 40, top = 28, bottom = 22;
    const w = svgW - left - right, h = svgH - top - bottom;

    // Dynamic Y-scale based strictly on visible data in the selected range
    const nonZeroSeries = series.filter((v) => v > 0);

    let minY: number;
    let maxY: number;

    if (isMobile) {
        minY = globalRange.min;
        maxY = globalRange.max;
    } else if (nonZeroSeries.length === 0) {
        minY = 0;
        maxY = 1;
    } else {
        minY = Math.min(...nonZeroSeries);
        maxY = Math.max(...nonZeroSeries);
        if (minY === maxY) {
            minY = minY - 1;
            maxY = maxY + 1;
        }
    }

    const y = (v: number) => top + h - ((v - minY) / (maxY - minY || 1)) * h;
    const x = (i: number) => left + (i / Math.max(1, Math.max(1, labels.length - 1))) * w;


    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minY + ((maxY - minY) * i) / ticks);

    const mkPath = (arr: number[]) => {
        let started = false, d = '';
        arr.forEach((v, i) => {
            if (!(Number.isFinite(v) && v > 0)) return;
            const cmd = started ? 'L' : 'M';
            started = true;
            d += `${cmd} ${x(i)} ${y(v)} `;
        });
        return d.trim();
    };
    const path = mkPath(series);

    const svgRef = useRef<SVGSVGElement | null>(null);
    const [hover, setHover] = useState<{ i: number; cx: number; cy: number | null } | null>(null);
    const [deletingDate, setDeletingDate] = useState<string | null>(null);
    const pointerActive = useRef(false);
    const isCoarsePointer = useIsCoarsePointer();
    const tipRef = useRef<HTMLDivElement | null>(null);
    const [tipW, setTipW] = useState(140);

    useEffect(() => {
        if (tipRef.current) {
            const w = tipRef.current.getBoundingClientRect().width;
            if (Number.isFinite(w) && w > 0) setTipW(w);
        }
    }, [hover?.i, hover?.cx, hover?.cy]);

    const updateHoverFromClientX = (clientX: number) => {
        if (!labels.length) return;
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const scaleX = svgW / rect.width;
        const mxView = (clientX - rect.left) * scaleX;
        const clamped = Math.max(left, Math.min(left + w, mxView));
        const ratio = (clamped - left) / w;
        const idx = Math.round(ratio * (Math.max(1, labels.length) - 1));
        const cx = x(idx);
        const cy = series[idx] > 0 ? y(series[idx]) : null;
        setHover({ i: idx, cx, cy });
    };

    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.pointerType !== 'mouse') {
            pointerActive.current = true;
            svgRef.current?.setPointerCapture(e.pointerId);
            e.preventDefault();
        }
        updateHoverFromClientX(e.clientX);
    };

    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === 'mouse') {
            updateHoverFromClientX(e.clientX);
            return;
        }
        if (!pointerActive.current) return;
        updateHoverFromClientX(e.clientX);
    };

    const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        if (pointerActive.current) {
            pointerActive.current = false;
            svgRef.current?.releasePointerCapture(e.pointerId);
        }
    };

    const onPointerLeave = (e: React.PointerEvent<SVGSVGElement>) => {
        pointerActive.current = false;
        if (e.pointerType === 'touch') {
            setHover(null);
            return;
        }
        const next = e.relatedTarget;
        if (next instanceof Node && tipRef.current && tipRef.current.contains(next)) {
            return;
        }
        setHover(null);
    };

    const onPointerCancel = () => {
        pointerActive.current = false;
        setHover(null);
    };

    const hoveredDate = hover ? labels[hover.i] : null;
    const hasValueForHover =
        hoveredDate && byDate[hoveredDate]?.some((v) => Number.isFinite(v) && v > 0) ? true : false;
    const canDelete = Boolean(onDelete && hoveredDate && hasValueForHover);
    const isDeleting = hoveredDate && deletingDate === hoveredDate;

    const handleDeleteDate = async (dateISO: string) => {
        if (!onDelete) return;
        setDeletingDate(dateISO);
        try {
            await onDelete(dateISO);
            setHover((prev) => {
                if (!prev) return prev;
                const prevDate = labels[prev.i];
                return prevDate === dateISO ? null : prev;
            });
        } catch (err) {
            console.error(err);
        } finally {
            setDeletingDate((prev) => (prev === dateISO ? null : prev));
        }
    };

    const handleTooltipLeave = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'touch') return;
        const next = event.relatedTarget;
        if (next instanceof Node && svgRef.current && svgRef.current.contains(next)) {
            return;
        }
        setHover(null);
    };

    const [openAdd, setOpenAdd] = useState(false);
    const [newDate, setNewDate] = useState<string>(fmtDate(new Date()));
    const [newW, setNewW] = useState<string>('');
    const dateInputRef = useRef<HTMLInputElement | null>(null);
    const expanderCls =
        'overflow-hidden transition-all duration-200 ease-out whitespace-nowrap flex items-center gap-2';

    const title =
        range === '1W' ? 'Past week' :
            range === '1M' ? 'Past month' :
                range === '3M' ? 'Past 3 months' :
                    range === '1Y' ? 'Past year' : 'Your bodyweight';

    const Delta = () =>
        delta && delta.diff !== 0 ? (
            <span
                className={`inline-flex items-center gap-1 text-xs ${
                    delta.diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}
            >
                {delta.diff > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span>{Math.abs(delta.diff)} {fmtUnit}</span>
            </span>
        ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">—</span>
        );

    // --- Tooltip left (CSS px) from hover.cx (SVG units), clamped to chart width ---
    let tooltipLeft = 0;
    if (hover) {
        const rect = svgRef.current?.getBoundingClientRect();
        const cssCX = rect ? (hover.cx / svgW) * rect.width : hover.cx;
        const min = 4;
        const max = (rect?.width ?? svgW) - tipW - 4;
        tooltipLeft = Math.max(min, Math.min(max, cssCX - tipW / 2));
    }

    return (
        <div className="relative flex h-full w-full flex-col">
            <div className="mb-3 flex flex-wrap items-center gap-3 sm:mb-1">
                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold whitespace-nowrap">{title}</h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                        <Delta />
                        <span className="text-zinc-400 dark:text-zinc-500">•</span>
                        <span className="uppercase tracking-wide">{fmtUnit}</span>
                    </div>
                </div>

                <div className="flex flex-nowrap items-center gap-2">
                    {isMobile ? (
                        <>
                            <div
                                className={`${expanderCls} ${
                                    openAdd
                                        ? 'max-w-[220px] opacity-100 ml-1'
                                        : 'max-w-0 opacity-0 ml-0 overflow-hidden pointer-events-none'
                                }`}
                            >
                                <div className="relative h-8 w-8">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            dateInputRef.current?.showPicker?.();
                                            dateInputRef.current?.focus();
                                        }}
                                        className="flex h-full w-full items-center justify-center rounded-lg border text-green-700 dark:border-white/20 dark:text-green-300"
                                        aria-label="Select date"
                                    >
                                        <Calendar size={16} />
                                    </button>
                                    <input
                                        ref={dateInputRef}
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        className="absolute inset-0 opacity-0 pointer-events-none"
                                    />
                                </div>
                                <input
                                    placeholder={fmtUnit}
                                    inputMode="decimal"
                                    className="h-8 w-20 rounded-lg border px-2 text-base outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                    value={newW}
                                    onChange={(e) => setNewW(e.target.value)}
                                />
                                <button
                                    className="h-8 w-8 rounded-lg bg-green-600 text-white hover:bg-green-700"
                                    onClick={() => {
                                        const n = parseFloat(newW);
                                        if (!isFinite(n) || n <= 0) return;
                                        const asLbs = unit === 'kg' ? n * LBS_PER_KG : n;
                                        onAdd(newDate, asLbs);
                                        setNewW('');
                                        setOpenAdd(false);
                                    }}
                                >
                                    <span className="text-lg leading-none">+</span>
                                </button>
                            </div>
                            <button
                                aria-label="Add bodyweight"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700"
                                onClick={() => setOpenAdd((v) => !v)}
                                title="Add bodyweight"
                            >
                                {openAdd ? <X size={14} /> : <Plus size={14} />}
                            </button>
                        </>
                    ) : (
                        <>
                            {openAdd && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        className="h-9 w-[100px] rounded-md border px-1 text-xs outline-none sm:h-7 sm:w-[130px] dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                    />
                                    <input
                                        placeholder={`weight (${fmtUnit})`}
                                        inputMode="decimal"
                                        className="h-9 w-[80px] rounded-md border px-1 text-xs outline-none sm:h-7 sm:w-[110px] dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                        value={newW}
                                        onChange={(e) => setNewW(e.target.value)}
                                    />
                                    <button
                                        className="h-9 rounded-md bg-green-600 px-3 text-xs text-white hover:bg-green-700 sm:h-7"
                                        onClick={() => {
                                            const n = parseFloat(newW);
                                            if (!isFinite(n) || n <= 0) return;
                                            const asLbs = unit === 'kg' ? n * LBS_PER_KG : n;
                                            onAdd(newDate, asLbs);
                                            setNewW('');
                                            setOpenAdd(false);
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>
                            )}
                            <button
                                aria-label="Add bodyweight"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 sm:h-7 sm:w-7"
                                onClick={() => setOpenAdd((v) => !v)}
                                title="Add bodyweight"
                            >
                                {openAdd ? <X size={14} /> : <Plus size={14} />}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Chart */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center pb-4">
                <div
                    ref={chartRef}
                    className="w-full xl:h-full"
                    style={{ height: svgH }}
                >
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        className="h-full w-full select-none"
                        preserveAspectRatio="xMidYMid meet"
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerLeave={onPointerLeave}
                        onPointerCancel={onPointerCancel}
                        style={isCoarsePointer ? { touchAction: 'none' } : undefined}
                    >
                    <line x1={40} y1={28 + (svgH - 28 - 22)} x2={40 + (svgW - 40 - 40)} y2={28 + (svgH - 28 - 22)} stroke={gridColor} />
                    <line x1={40} y1={28} x2={40} y2={28 + (svgH - 28 - 22)} stroke={gridColor} />
                    {yTicks.map((t, i) => {
                        const yy = 28 + (svgH - 28 - 22) - ((t - minY) / (maxY - minY || 1)) * (svgH - 28 - 22);
                        return (
                            <g key={i}>
                                <line x1={40} y1={yy} x2={40 + (svgW - 40 - 40)} y2={yy} stroke={innerGrid} strokeDasharray={i === 0 ? undefined : '3 6'} />
                                <text x={34} y={yy + 3} fontSize="10" textAnchor="end" fill={labelColor}>
                                    {t.toFixed(1)}
                                </text>
                            </g>
                        );
                    })}
                    {labels.length > 0 && (
                        <>
                            <text x={40} y={28 + (svgH - 28 - 22) + 14} fontSize="9" textAnchor="start" fill={labelColor}>
                                {labels[0].slice(5).replace('-', '/')}
                            </text>
                            <text x={40 + (svgW - 40 - 40)} y={28 + (svgH - 28 - 22) + 14} fontSize="9" textAnchor="end" fill={labelColor}>
                                {labels[Math.max(0, labels.length - 1)].slice(5).replace('-', '/')}
                            </text>
                        </>
                    )}
                    {series.some((v) => v > 0) && path && (
                        <path d={path} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" opacity={0.95} />
                    )}
                    {series.map((v, i) =>
                        v > 0 ? (
                            <circle
                                key={i}
                                cx={40 + (i / Math.max(1, Math.max(1, labels.length - 1))) * (svgW - 40 - 40)}
                                cy={28 + (svgH - 28 - 22) - ((v - minY) / (maxY - minY || 1)) * (svgH - 28 - 22)}
                                r={3}
                                fill={lineColor}
                                opacity={0.8}
                            />
                        ) : null
                    )}
                    {hover && labels.length > 0 && (
                        <>
                            <line x1={hover.cx} y1={28} x2={hover.cx} y2={28 + (svgH - 28 - 22)} stroke={hoverLineColor} strokeDasharray="4 6" />
                            {hover.cy != null && <circle cx={hover.cx} cy={hover.cy} r={3.8} fill={hoverDotFill} stroke={lineColor} strokeWidth={2} />}
                        </>
                    )}
                    <rect x={40} y={28} width={svgW - 40 - 40} height={svgH - 28 - 22} fill="transparent" />
                    </svg>
                </div>

                {/* Hover tooltip (date + value) */}
                {hover && labels.length > 0 && (
                    <div
                        ref={tipRef}
                        className="absolute rounded-lg border bg-white px-3 py-2 text-[12px] shadow dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100"
                        style={{ left: tooltipLeft, top: 120 }}
                        onPointerLeave={handleTooltipLeave}
                    >
                        <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                {labels[hover.i]}
                            </div>
                            {canDelete && hoveredDate && (
                                <button
                                    type="button"
                                    className="rounded-full border border-transparent p-1 text-red-500 hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:border-red-400/40 dark:hover:bg-red-500/10"
                                    onClick={() => handleDeleteDate(hoveredDate)}
                                    disabled={Boolean(isDeleting)}
                                    aria-label="Delete bodyweight entry"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="inline-flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#16a34a' }} />
                            <span className="font-medium">
                                {series[hover.i] ? `${series[hover.i].toFixed(1)} ${fmtUnit}` : '—'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Range + Unit toggle (bottom-right, outside chart area) */}
            {/* Bottom controls: centered range buttons + bottom-right unit toggle */}
            <div className="relative mt-2 h-10">
                {/* Centered range buttons */}
                <div className="pointer-events-auto absolute inset-0 flex items-center justify-center gap-2 pr-[30px] sm:pr-[110px] xl:pr-0">
                    {(['1W', '1M', '3M', '1Y', 'ALL'] as const).map((r) => (
                        <button
                            key={r}
                            className={`h-8 rounded-full px-3 text-sm ${
                                r === range
                                    ? 'bg-black text-white dark:bg-white dark:text-black'
                                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10'
                            }`}
                            onClick={() => setRange(r)}
                        >
                            {r}
                        </button>
                    ))}
                </div>

                {/* lbs/kg toggle pinned bottom-right */}
                <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center">
                    <button
                        role="switch"
                        aria-checked={unit === 'kg'}
                        onClick={() => setUnit(unit === 'lbs' ? 'kg' : 'lbs')}
                        className="hidden sm:inline-flex h-9 w-[108px] items-center justify-between rounded-full px-2 text-xs font-semibold uppercase tracking-wide transition dark:text-neutral-200"
                        title="Toggle units"
                    >
                        <span className={unit === 'lbs' ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}>lbs</span>
                        <div className="relative h-7 w-14 rounded-full border border-zinc-300 bg-white/90 px-1 dark:border-white/20 dark:bg-white/5">
                            <span
                                className={`absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-zinc-800 transition-transform dark:bg-white ${
                                    unit === 'kg' ? 'translate-x-[22px]' : 'translate-x-0'
                                }`}
                            />
                        </div>
                        <span className={unit === 'kg' ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}>kg</span>
                    </button>

                    <button
                        role="switch"
                        aria-checked={unit === 'kg'}
                        onClick={() => setUnit(unit === 'lbs' ? 'kg' : 'lbs')}
                        className="inline-flex h-9 w-[48px] items-center justify-center rounded-full px-1 transition sm:hidden"
                        title="Toggle units"
                    >
                        <span
                            className={`flex h-5 w-10 items-center rounded-full border border-neutral-300 dark:border-neutral-900 dark:bg-white/20 transition-transform ${
                                unit === 'kg' ? 'justify-end' : 'justify-start'
                            }`}
                        >
                            <span className="m-0.5 h-4 w-4 rounded-full bg-zinc-800 dark:bg-white" />
                        </span>
                    </button>
                </div>
            </div>

        </div>
    );
}

/** ---------- Generic Year Heatmap (accepts levels/colors) ---------- */
function YearHeatmap({
    width,
    height,
    valuesByDate,
    levels,
    colors,
    showAlternateDays = false,
    isDark = false,
}: {
    width: number;
    height: number;
    valuesByDate: Record<string, number>;
    levels: number[];
    colors: string[];
    showAlternateDays?: boolean;
    isDark?: boolean;
}) {
    const cols = 53, rows = 7, pad = 8, labelTop = 14, labelRight = 30, gap = 1.8;
    const innerW = width - pad * 2 - labelRight;
    const innerH = height - pad * 2 - labelTop;
    const cell = Math.min(innerW / cols - gap, innerH / rows - gap);

    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = new Date(todayUTC);
    start.setUTCDate(start.getUTCDate() - 364);
    const backToMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - backToMonday);

    const data: { d: Date; key: string; val: number }[] = [];
    for (let i = 0; i < cols * rows; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        const key = fmtDate(d);
        data.push({ d, key, val: valuesByDate[key] || 0 });
    }

    const monthTicks: { label: string; col: number }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < data.length; i++) {
        const { d } = data[i];
        if (d.getUTCDate() === 1) {
            const col = Math.floor(i / 7);
            if (!monthTicks.some((t) => t.col === col)) monthTicks.push({ label: monthNames[d.getUTCMonth()], col });
        }
    }

    const fullDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const altDayLabels = ['Mon', 'Wed', 'Fri', 'Sun'];
    const dayLabels = showAlternateDays ? altDayLabels : fullDayLabels;
    const dayIndices = showAlternateDays ? [0, 2, 4, 6] : [0, 1, 2, 3, 4, 5, 6];
    const labelColor = isDark ? '#d1d5db' : '#6b7280';
    const borderColor = isDark ? '#4b5563' : undefined;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
            {data.map((item, idx) => {
                const c = Math.floor(idx / 7);
                const r = idx % 7;
                const x = 8 + c * (cell + gap);
                const y = 8 + labelTop + r * (cell + gap);
                const li = levels.findIndex((t) => item.val <= t);
                const fill = colors[Math.max(0, li)];
                return (
                    <rect
                        key={idx}
                        x={x}
                        y={y}
                        width={cell}
                        height={cell}
                        rx="2"
                        ry="2"
                        fill={fill}
                        stroke={borderColor}
                        strokeWidth={borderColor ? 0.7 : 0}
                    />
                );
            })}

            {monthTicks.map((t, i) => {
                const x = 8 + t.col * (cell + gap) + cell / 2;
                return <text key={i} x={x} y={18} fontSize="10" textAnchor="middle" fill={labelColor}>{t.label}</text>;
            })}

            {dayLabels.map((lb, ix) => {
                const r = dayIndices[ix];
                const y = 8 + labelTop + r * (cell + gap) + cell * 0.7;
                const x = width - 26;
                return <text key={lb} x={x} y={y} fontSize="10" textAnchor="start" fill={labelColor}>{lb}</text>;
            })}
        </svg>
    );
}

/** Responsive wrapper */
function ResponsiveHeatmap({
    valuesByDate,
    height,
    showAlternateDays = false,
    levels,
    colors,
    isDark = false,
}: {
    valuesByDate: Record<string, number>;
    height: number;
    showAlternateDays?: boolean;
    levels: number[];
    colors: string[];
    isDark?: boolean;
}) {
    const { ref, width } = useMeasure<HTMLDivElement>();
    const w = Math.max(420, Math.floor(width));
    return (
        <div ref={ref} className="h-[200px] w-full">
            <YearHeatmap
                valuesByDate={valuesByDate}
                height={height}
                showAlternateDays={showAlternateDays}
                width={w}
                levels={levels}
                colors={colors}
                isDark={isDark}
            />
        </div>
    );
}

/** ---------- small helpers ---------- */
function HeatmapLegend({ metric, levels, colors, isDark }: { metric: HMMetric; levels: number[]; colors: string[]; isDark: boolean }) {
    // levels = [0, t1, t2, t3, Infinity]
    const labels = [
        '0',
        `≤${levels[1]}`,
        `≤${levels[2]}`,
        `≤${levels[3]}`,
        metric === 'kcal'
            ? `${Number.isFinite(levels[3]) ? `${levels[3]}+` : '3000+'}`
            : `${Number.isFinite(levels[3]) ? `${levels[3]}+` : '+'}`,
    ];
    const borderColor = isDark ? '#4b5563' : undefined;
    return (
        <div className="flex flex-nowrap items-center gap-6 whitespace-nowrap text-[11px] text-zinc-600 dark:text-zinc-300 xl:flex-wrap flex-shrink-0">
            <LegendItem label={labels[0]} color={colors[0]} borderColor={borderColor} />
            <LegendItem label={labels[1]} color={colors[1]} />
            <LegendItem label={labels[2]} color={colors[2]} />
            <LegendItem label={labels[3]} color={colors[3]} />
            <LegendItem label={labels[4]} color={colors[4]} />
        </div>
    );
}

function LegendItem({ label, color, borderColor }: { label: string; color: string; borderColor?: string }) {
    const style: React.CSSProperties = { background: color };
    if (borderColor) {
        style.border = `1px solid ${borderColor}`;
    }
    return (
        <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded" style={style} />
            <span>{label}</span>
        </div>
    );
}

function mealMetric(
    meal: Meal,
    meals: { meal: Meal; items: { food: Food; servings: number }[] }[],
    metric: 'kcal' | 'p' | 'c' | 'f'
) {
    const items = meals.find((m) => m.meal === meal)?.items || [];
    const total = items.reduce((acc, it) => acc + (it.food.macros[metric] as number) * it.servings, 0);
    return Math.round(total);
}

/** ---------- Edit Goals Modal ---------- */
function EditGoalsModal({
    initial,
    onSave,
    onClose,
}: {
    initial: Macro;
    onSave: (m: Macro) => void | Promise<void>;
    onClose: () => void;
}) {
    const [form, setForm] = useState<Macro>(initial);
    const field = 'h-10 w-full rounded-md border px-3 text-sm outline-none';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-3">
            <div className="w-full max-w-[480px] rounded-xl border bg-white p-4 shadow-xl dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">Edit macro goals</h3>
                    <button className="rounded-md p-1 hover:bg-zinc-100 dark:hover:bg-white/10" onClick={onClose} aria-label="Close"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-xs text-zinc-600">Calories (kcal)</label>
                        <input className={field} type="number" inputMode="numeric" value={form.kcal}
                            onChange={(e) => setForm((s) => ({ ...s, kcal: Number(e.target.value) || 0 }))} />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-zinc-600">Protein (g)</label>
                        <input className={field} type="number" inputMode="numeric" value={form.p}
                            onChange={(e) => setForm((s) => ({ ...s, p: Number(e.target.value) || 0 }))} />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-zinc-600">Fat (g)</label>
                        <input className={field} type="number" inputMode="numeric" value={form.f}
                            onChange={(e) => setForm((s) => ({ ...s, f: Number(e.target.value) || 0 }))} />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-zinc-600">Carbs (g)</label>
                        <input className={field} type="number" inputMode="numeric" value={form.c}
                            onChange={(e) => setForm((s) => ({ ...s, c: Number(e.target.value) || 0 }))} />
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                    <button className="rounded-md border px-3 py-2 text-sm hover:border-zinc-400 dark:hover:border-white/40" onClick={onClose}>Cancel</button>
                    <button
                        className="rounded-md border px-3 py-2 text-sm hover:border-zinc-400 dark:hover:border-white/40"
                        onClick={() => { void onSave(form); }}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

/** ---------- Sleek Edit Heatmap Keys Modal ---------- */
function EditLevelsModal({
    initial,
    onSave,
    onClose,
}: {
    initial: Record<HMMetric, number[]>;
    onSave: (levels: Record<HMMetric, number[]>) => void | Promise<void>;
    onClose: () => void;
}) {
    // Keep only editable thresholds (t1..t3). Index 0 fixed at 0; index 4 at Infinity.
    const [form, setForm] = useState<Record<HMMetric, [number, number, number]>>({
        kcal: [initial.kcal[1], initial.kcal[2], initial.kcal[3]],
        f: [initial.f[1], initial.f[2], initial.f[3]],
        c: [initial.c[1], initial.c[2], initial.c[3]],
        p: [initial.p[1], initial.p[2], initial.p[3]],
    });

    const field = 'h-9 w-full rounded-md border px-2 text-sm outline-none';

    const rows: { key: HMMetric; label: string; unit: string }[] = [
        { key: 'kcal', label: 'Calories', unit: 'kcal' },
        { key: 'p', label: 'Protein', unit: 'g' },
        { key: 'f', label: 'Fat', unit: 'g' },
        { key: 'c', label: 'Carbs', unit: 'g' },
    ];

    function save() {
        const next: Record<HMMetric, number[]> = { kcal: [], f: [], c: [], p: [] } as any;
        (['kcal', 'f', 'c', 'p'] as HMMetric[]).forEach((k) => {
            let [t1, t2, t3] = form[k];
            t1 = Number.isFinite(t1) ? Math.max(0, t1) : 0;
            t2 = Number.isFinite(t2) ? Math.max(t1, t2) : t1;
            t3 = Number.isFinite(t3) ? Math.max(t2, t3) : t2;
            next[k] = [0, t1, t2, t3, Infinity];
        });
        void onSave(next);
    }

    const onChange = (k: HMMetric, idx: 0 | 1 | 2, val: string) => {
        const n = Number(val);
        setForm((cur) => {
            const copy = { ...cur };
            const arr = [...copy[k]] as [number, number, number];
            arr[idx] = isFinite(n) ? n : 0;
            copy[k] = arr;
            return copy;
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-3">
            <div className="w-full max-w-[540px] rounded-xl border bg-white p-4 shadow-xl dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">Heatmap keys</h3>
                    <button className="rounded-md p-1 hover:bg-zinc-100 dark:hover:bg-white/10" onClick={onClose} aria-label="Close"><X size={16} /></button>
                </div>

                {/* Minimal, compact grid */}
                <div className="rounded-lg border dark:border-white/20">
                    <div className="grid grid-cols-12 items-center border-b bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                        <div className="col-span-4">Metric</div>
                        <div className="col-span-2 text-center">t1</div>
                        <div className="col-span-2 text-center">t2</div>
                        <div className="col-span-2 text-center">t3</div>
                        <div className="col-span-2 text-right pr-1">t3+</div>
                    </div>

                    {rows.map((r, i) => (
                        <div key={r.key} className={`grid grid-cols-12 items-center px-3 py-2 ${i < rows.length - 1 ? 'border-b' : ''}`}>
                            <div className="col-span-4 text-sm">
                                <span className="font-medium">{r.label}</span>
                                <span className="ml-2 rounded-full border px-2 py-[2px] text-[10px] text-zinc-500">{r.unit}</span>
                            </div>
                            <div className="col-span-2 px-1">
                                <input className={field} type="number" inputMode="numeric" value={form[r.key][0]}
                                    onChange={(e) => onChange(r.key, 0, e.target.value)} />
                            </div>
                            <div className="col-span-2 px-1">
                                <input className={field} type="number" inputMode="numeric" value={form[r.key][1]}
                                    onChange={(e) => onChange(r.key, 1, e.target.value)} />
                            </div>
                            <div className="col-span-2 px-1">
                                <input className={field} type="number" inputMode="numeric" value={form[r.key][2]}
                                    onChange={(e) => onChange(r.key, 2, e.target.value)} />
                            </div>
                            <div className="col-span-2 text-right pr-1 text-sm text-zinc-500">t3+</div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                    <button className="rounded-md border px-3 py-2 text-sm hover:border-zinc-400 dark:hover:border-white/40" onClick={onClose}>Cancel</button>
                    <button className="rounded-md border px-3 py-2 text-sm hover:border-zinc-400 dark:hover:border-white/40" onClick={save}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
