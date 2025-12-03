'use client';

import Link from 'next/link';
import MobileHeader from '@/components/MobileHeader';
import { useMemo, useRef, useState, useEffect } from 'react';
import { Plus, X, Trash2, ArrowUpRight, ArrowDownRight, Sliders } from 'lucide-react';

import {
    fetchAllNutritionData,
    addNutritionEntryServer,
    deleteNutritionEntryServer,
    upsertBodyweightServer,
    saveCustomFoodServer,
    type NutritionEntryDTO,
    type BodyweightDTO,
    type CustomFoodDTO,
} from '@/components/nutritionActions';

/** ---------- shared helpers ---------- */
function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
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

/** ---------- types ---------- */
type Macro = { kcal: number; p: number; f: number; c: number };
type Food = { id: string; name: string; macros: Macro };
type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type BWPoint = { date: string; weight: number };
type RangeKey = '1W' | '1M' | '3M' | '1Y' | 'ALL';
type Metric = 'kcal' | 'p' | 'c' | 'f';
type HMMetric = 'kcal' | 'f' | 'c' | 'p';

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
const COLORS = ['#e5e7eb', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399'];

/** ---------- page ---------- */
export default function Nutrition() {
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

    /** Load everything from server on mount */
    useEffect(() => {
        (async () => {
            try {
                const data = await fetchAllNutritionData();
                setEntries(data.entries || []);
                setBodyweights(data.bodyweights || []);
                setCustomFoods(data.customFoods || []);
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    /** Layout */
    const mobileTabs = (
        <div className="px-4 py-3 flex gap-2 text-sm">
            <Link href="/dashboard" className="flex-1 rounded-full px-4 py-2 text-center border text-black">
                workouts
            </Link>
            <Link href="/dashboard/wellness" className="flex-1 rounded-full px-4 py-2 text-center border text-black">
                wellness
            </Link>
            <Link href="/dashboard/nutrition" className="flex-1 rounded-full px-4 py-2 text-center bg-black text-white">
                nutrition
            </Link>
        </div>
    );

    return (
        <div className="flex min-h-screen flex-col overflow-hidden bg-[#f8f8f8]">
            <MobileHeader title="nutrition log" href="/dashboard/nutrition" subContent={mobileTabs} />

            {/* Header */}
            <header className="hidden lg:flex w-full flex-none items-center justify-between bg-white px-[40px] py-5">
                <h1 className="select-none font-roboto text-3xl text-black tracking-tight">nutrition log</h1>
                <nav className="flex gap-2">
                    <Link href="/dashboard" className="px-6 py-2 text-black hover:underline">workouts</Link>
                    <Link href="/dashboard/wellness" className="px-6 py-2 text-black hover:underline">wellness</Link>
                    <Link href="/dashboard/nutrition" className="bg-black px-6 py-2 text-white">nutrition</Link>
                </nav>
            </header>

            {/* Content */}
            <div className="w-full flex-1 overflow-hidden px-6 pb-4 pt-4">
                <div className="grid h-full min-w-0 grid-cols-12 gap-6">
                    {/* LEFT — Macros flip card (with date switcher) */}
                    <section className="col-span-4 min-h-0">
                        <MacrosFlipCard
                            dateISO={dateISO}
                            onDateChange={setDateISO}
                            goals={goals}
                            consumed={consumed}
                            meals={mealsForDate}
                            onEditGoals={() => setOpenEditGoals(true)}
                            addUI={{ q, setQ, serv, setServ, targetMeal, setTargetMeal, addFood, customFoods, setCustomFoods }}
                        />
                    </section>

                    {/* MIDDLE — Bodyweight + Heatmap */}
                    <section className="col-span-5 min-h-0">
                        <div className="flex h-full min-h-0 flex-col gap-3">
                            <div className="relative min-h-0 flex-[60] rounded-xl border bg-white p-3 shadow-sm">
                                <BWChartLiftsStyle points={bw} onAdd={(d, w) => addBw(d, w)} />
                            </div>

                            <div className="relative min-h-0 flex flex-[40] flex-col rounded-xl border bg-white p-3 shadow-sm">
                                <div className="mb-1 flex items-center justify-between">
                                    <h3 className="font-semibold">
                                        {new Date().getFullYear()} {heatMetric === 'kcal' ? 'calories' : heatMetric === 'f' ? 'fat' : heatMetric === 'c' ? 'carbs' : 'protein'}
                                    </h3>

                                    <div className="flex items-center gap-2">
                                        <div className="text-[11px] text-zinc-500">
                                            {heatMetric === 'kcal' ? 'kcal per day' : 'g per day'}
                                        </div>
                                        <div className="ml-2 inline-flex rounded-lg border bg-white p-1 text-xs">
                                            {(['kcal', 'f', 'c', 'p'] as HMMetric[]).map((m) => (
                                                <button
                                                    key={m}
                                                    onClick={() => setHeatMetric(m)}
                                                    className={`rounded-md px-2 py-1 capitalize ${heatMetric === m ? 'bg-black text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
                                                    title={m === 'kcal' ? 'Calories' : m === 'f' ? 'Fat' : m === 'c' ? 'Carbs' : 'Protein'}
                                                >
                                                    {m === 'kcal' ? 'kcal' : m === 'f' ? 'fat' : m === 'c' ? 'carbs' : 'protein'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-1 items-center justify-center">
                                    <div className="translate-y-[10px]">
                                        <ResponsiveHeatmap
                                            valuesByDate={valuesByDateMetric}
                                            height={180}
                                            showAlternateDays
                                            levels={heatmapLevels[heatMetric]}
                                            colors={COLORS}
                                        />
                                    </div>
                                </div>

                                {/* Dynamic legend */}
                                <HeatmapLegend metric={heatMetric} levels={heatmapLevels[heatMetric]} />

                                {/* Bottom-right edit button */}
                                <button
                                    onClick={() => setOpenEditLevels(true)}
                                    className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-zinc-50"
                                    title="Edit heatmap keys"
                                >
                                    <Sliders size={14} />
                                    Edit keys
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* RIGHT — Meals for selected date */}
                    <section className="col-span-3 min-h-0">
                        <div className="flex h-full min-h-0 flex-col">
                            <div className="min-h-0 flex-1 rounded-xl border bg-white p-3 shadow-sm">
                                <div className="mb-2 flex items-center justify-between">
                                    <h3 className="font-semibold">
                                        {dateISO === fmtDate(new Date()) ? "Today’s meals" : `${dateISO} meals`}
                                    </h3>
                                    <input
                                        type="date"
                                        value={dateISO}
                                        onChange={(e) => setDateISO(e.target.value)}
                                        className="h-7 rounded-md border px-2 text-xs outline-none"
                                        aria-label="Change date"
                                    />
                                </div>

                                <div className="h-[calc(100%-36px)] space-y-3 overflow-y-auto pr-1">
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
                                                        <li key={it.id} className="flex items-center justify-between text-sm">
                                                            <span className="min-w-0 truncate">{it.food.name}</span>
                                                            <span className="ml-2 flex items-center gap-3 text-zinc-500">
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
                    onSave={(next) => { setGoals(next); setOpenEditGoals(false); }}
                />
            )}
            {openEditLevels && (
                <EditLevelsModal
                    initial={heatmapLevels}
                    onClose={() => setOpenEditLevels(false)}
                    onSave={(next) => { setHeatmapLevels(next); setOpenEditLevels(false); }}
                />
            )}
        </div>
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
        setCustomFoods: (f: CustomFoodDTO[]) => void;
    };
}) {
    const [flipped, setFlipped] = useState(false);

    return (
        <div className="h-full rounded-xl border bg-white shadow-sm [perspective:1200px]">
            {/* toolbar */}
            <div className="flex items-center justify-between px-4 pt-4">
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold">
                        {dateISO === fmtDate(new Date()) ? "Today's macros" : `Macros for ${dateISO}`}
                    </h3>
                    <input
                        type="date"
                        value={dateISO}
                        onChange={(e) => onDateChange(e.target.value)}
                        className="h-7 rounded-md border px-2 text-xs outline-none"
                        aria-label="Change date"
                    />
                </div>
                <button
                    aria-label={flipped ? 'Close add food' : 'Add food'}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${flipped ? 'bg-neutral-200 text-black' : 'bg-black text-white'} hover:opacity-90`}
                    onClick={() => setFlipped((v) => !v)}
                    title={flipped ? 'Close' : 'Add food'}
                >
                    {flipped ? <X size={16} /> : <Plus size={16} />}
                </button>
            </div>

            {/* flip container */}
            <div
                className={`relative h-[calc(100%-48px)] w-full transition-transform duration-300 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
            >
                {/* FRONT — rings + Edit button (bottom-right) */}
                <div className="absolute inset-0 backface-hidden p-4">
                    <div className="relative flex h-full items-center justify-center">
                        <div className="grid w-full grid-cols-2 place-items-center gap-5 md:gap-0">
                            <RingBig label="calories (kcal)" value={consumed.kcal} goal={goals.kcal} color="#ef4444" />
                            <RingBig label="protein (g)" value={consumed.p} goal={goals.p} color="#6cf542" />
                            <RingBig label="fat (g)" value={consumed.f} goal={goals.f} color="#f5e642" />
                            <RingBig label="carbs (g)" value={consumed.c} goal={goals.c} color="#3b82f6" />
                        </div>

                        <button
                            onClick={onEditGoals}
                            className="absolute bottom-2 right-2 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-zinc-50"
                            title="Edit macro goals"
                        >
                            <Sliders size={14} />
                            Edit macros
                        </button>
                    </div>
                </div>

                {/* BACK — Add food */}
                <div className="absolute inset-0 overflow-hidden p-4 [transform:rotateY(180deg)] backface-hidden">
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
        <div className="relative flex items-center justify-center bg-white p-2">
            <svg viewBox="0 0 240 240" className="aspect-square w-full max-w-[230px]">
                <circle cx="120" cy="120" r={R} stroke="#e5e7eb" strokeWidth="10" fill="none" strokeLinecap="round" />
                <circle cx="120" cy="120" r={R} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={`${C * pct},999`} transform="rotate(-90 120 120)" />
            </svg>
            <div className="absolute text-center">
                <div className="text-lg md:text-xl font-semibold">{value} / {goal}</div>
                <div className="text-xs md:text-sm text-neutral-500">{label}</div>
            </div>
        </div>
    );
}

/** Back face: Add food with custom food creator */
function AddFoodPanel({
    q, setQ, serv, setServ, targetMeal, setTargetMeal, addFood, meals, customFoods, setCustomFoods,
}: {
    q: string; setQ: (v: string) => void;
    serv: string; setServ: (v: string) => void;
    targetMeal: Meal; setTargetMeal: (m: Meal) => void;
    addFood: (food: Food) => void;
    meals: { meal: Meal; items: { food: Food; servings: number; time?: string }[] }[];
    customFoods: CustomFoodDTO[];
    setCustomFoods: (f: CustomFoodDTO[]) => void;
}) {
    const [metric, setMetric] = useState<Metric>('kcal');
    const [cf, setCf] = useState({ name: '', grams: '', kcal: '', p: '', c: '', f: '' });
    const [showCustom, setShowCustom] = useState(false);

    const fieldCls = 'h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-black/10';

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

    const customFoodAsFood: Food[] = customFoods.map((cf) => ({
        id: cf.id,
        name: `${cf.name} (${cf.grams}g)`,
        macros: { kcal: cf.kcal, p: cf.p, c: cf.c, f: cf.f },
    }));

    const list = [...customFoodAsFood, ...FOOD_DB].filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));

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
                    className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm hover:bg-zinc-50"
                >
                    {showCustom ? <X size={16} /> : <Plus size={16} />}
                    {showCustom ? 'Close custom food' : 'Add custom food'}
                </button>
            </div>

            {/* Collapsible custom food form */}
            <div id="custom-food-panel" className={`mt-2 overflow-hidden rounded-lg border transition-all duration-300 ${showCustom ? 'max-h-[520px] opacity-100 p-3' : 'max-h-0 opacity-0 p-0'}`}>
                <div className="grid grid-cols-12 gap-2">
                    <input className={`${fieldCls} col-span-12 md:col-span-6`} placeholder="Name" value={cf.name} onChange={(e) => setCf((s) => ({ ...s, name: e.target.value }))} />
                    <input className={`${fieldCls} col-span-6 md:col-span-3`} placeholder="Grams" inputMode="numeric" value={cf.grams} onChange={(e) => setCf((s) => ({ ...s, grams: e.target.value }))} />
                    <input className={`${fieldCls} col-span-6 md:col-span-3`} placeholder="Calories" inputMode="numeric" value={cf.kcal} onChange={(e) => setCf((s) => ({ ...s, kcal: e.target.value }))} />
                    <input className={`${fieldCls} col-span-4 md:col-span-3`} placeholder="Protein" inputMode="numeric" value={cf.p} onChange={(e) => setCf((s) => ({ ...s, p: e.target.value }))} />
                    <input className={`${fieldCls} col-span-4 md:col-span-3`} placeholder="Carbs" inputMode="numeric" value={cf.c} onChange={(e) => setCf((s) => ({ ...s, c: e.target.value }))} />
                    <input className={`${fieldCls} col-span-4 md:col-span-3`} placeholder="Fat" inputMode="numeric" value={cf.f} onChange={(e) => setCf((s) => ({ ...s, f: e.target.value }))} />
                    <div className="col-span-4 md:col-span-3 flex items-center">
                        <button className="h-10 w-full rounded-md bg-black px-4 text-sm text-white hover:opacity-90" onClick={addCustomFood}>Save</button>
                    </div>
                </div>
            </div>

            {/* list */}
            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border">
                <ul className="divide-y">
                    {list.map((f) => (
                        <li key={f.id} className="flex items-center justify-between p-3">
                            <div className="min-w-0">
                                <div className="truncate font-medium">{f.name}</div>
                                <div className="text-xs text-zinc-500">{f.macros.kcal} kcal • P {f.macros.p} • C {f.macros.c} • F {f.macros.f}</div>
                            </div>
                            <button className="rounded-full border p-2 hover:bg-zinc-50" onClick={() => addFood(f)} title="Add">
                                <Plus size={16} />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* metric toggle + per-meal tiles */}
            <div className="mt-3">
                <div className="mb-2 inline-flex rounded-lg border bg-white p-1 text-sm">
                    {(['kcal', 'p', 'c', 'f'] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setMetric(m)}
                            className={`rounded-md px-3 py-1 capitalize ${metric === m ? 'bg-black text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
                            title={m === 'kcal' ? 'Calories' : m === 'p' ? 'Protein' : m === 'c' ? 'Carbs' : 'Fat'}
                        >
                            {m === 'kcal' ? 'kcal' : m === 'p' ? 'protein' : m === 'c' ? 'carbs' : 'fat'}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-[12px]">
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
                        <div key={m} className="rounded border bg-white px-2 py-1">
                            <div className="text-[10px] uppercase tracking-wide text-zinc-500">{m}</div>
                            <div className="text-zinc-700">{mealMetric(m, meals as any, metric)} {unitLabel}</div>
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
}: {
    points: BWPoint[];
    onAdd: (dateISO: string, weight: number) => void;
}) {
    const [range, setRange] = useState<RangeKey>('1W');
    const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');

    const LBS_PER_KG = 2.20462262185;
    const toDisplay = (vLbs: number) => unit === 'kg' ? vLbs / LBS_PER_KG : vLbs;
    const fmtUnit = unit;

    const { ref, width } = useMeasure<HTMLDivElement>();
    const svgW = Math.max(770, Math.floor(width));
    const svgH = 280;

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

    if (nonZeroSeries.length === 0) {
        // No data in this range – use a tiny default span
        minY = 0;
        maxY = 1;
    } else {
        // Min and max are the lowest & highest data points in this time frame
        minY = Math.min(...nonZeroSeries);
        maxY = Math.max(...nonZeroSeries);

        // If all visible points are the same value, give a small buffer
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
    const tipRef = useRef<HTMLDivElement | null>(null);
    const [tipW, setTipW] = useState(140);

    useEffect(() => {
        if (tipRef.current) {
            const w = tipRef.current.getBoundingClientRect().width;
            if (Number.isFinite(w) && w > 0) setTipW(w);
        }
    }, [hover?.i, hover?.cx, hover?.cy]);

    const onMove = (e: React.MouseEvent) => {
        if (!labels.length) return;
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const scaleX = svgW / rect.width;
        const mxView = (e.clientX - rect.left) * scaleX;
        const clamped = Math.max(left, Math.min(left + w, mxView));
        const ratio = (clamped - left) / w;
        const idx = Math.round(ratio * (Math.max(1, labels.length) - 1));
        const cx = x(idx);
        const cy = series[idx] > 0 ? y(series[idx]) : null;
        setHover({ i: idx, cx, cy });
    };
    const onLeave = () => setHover(null);

    const [openAdd, setOpenAdd] = useState(false);
    const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [newW, setNewW] = useState<string>('');
    const expanderCls = 'overflow-hidden transition-all duration-200 ease-out whitespace-nowrap flex items-center gap-1';

    const title =
        range === '1W' ? 'Past week' :
            range === '1M' ? 'Past month' :
                range === '3M' ? 'Past 3 months' :
                    range === '1Y' ? 'Past year' : 'Your bodyweight';

    const Delta = () =>
        delta && delta.diff !== 0 ? (
            <span className={`ml-2 inline-flex items-center gap-1 text-xs ${delta.diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {delta.diff > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(delta.diff)} {fmtUnit}
            </span>
        ) : (
            <span className="ml-2 text-xs text-zinc-500">—</span>
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
        <div className="relative flex h-full w-full flex-col" ref={ref}>
            <div className="mb-1 flex items-center justify-between">
                <div className="min-w-0">
                    <h3 className="font-semibold whitespace-nowrap">{title}</h3>
                    <div className="flex items-center text-xs text-zinc-600">
                        <span>{fmtUnit}</span>
                        <Delta />
                    </div>
                </div>

                <div className="flex w-[360px] shrink-0 items-center justify-end">
                    <div className={`${expanderCls} ${openAdd ? 'mr-1 max-w-[320px] opacity-100' : 'mr-0 max-w-0 opacity-0'}`}>
                        <input
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="h-7 w-[150px] rounded-md border px-2 text-xs outline-none"
                        />
                        <input
                            placeholder={`weight (${fmtUnit})`}
                            inputMode="decimal"
                            className="h-7 w-[100px] rounded-md border px-2 text-xs outline-none"
                            value={newW}
                            onChange={(e) => setNewW(e.target.value)}
                        />
                        <button
                            className="h-7 rounded-md bg-green-600 px-2 text-xs text-white hover:bg-green-700"
                            onClick={() => {
                                const n = parseFloat(newW);
                                if (!isFinite(n) || n <= 0) return;
                                // Convert to storage unit (assumed lbs)
                                const asLbs = unit === 'kg' ? n * LBS_PER_KG : n;
                                onAdd(newDate, asLbs);
                                setNewW('');
                                setOpenAdd(false);
                            }}
                        >
                            Add
                        </button>
                    </div>
                    <button
                        aria-label="Add bodyweight"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700"
                        onClick={() => setOpenAdd((v) => !v)}
                        title="Add bodyweight"
                    >
                        {openAdd ? <X size={14} /> : <Plus size={14} />}
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center pb-4">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="h-[100%] w-[100%] select-none"
                    onMouseMove={onMove}
                    onMouseLeave={onLeave}
                >
                    <line x1={40} y1={28 + (svgH - 28 - 22)} x2={40 + (svgW - 40 - 40)} y2={28 + (svgH - 28 - 22)} stroke="#e5e7eb" />
                    <line x1={40} y1={28} x2={40} y2={28 + (svgH - 28 - 22)} stroke="#e5e7eb" />
                    <line x1={40 + (svgW - 40 - 40)} y1={28} x2={40 + (svgW - 40 - 40)} y2={28 + (svgH - 28 - 22)} stroke="#e5e7eb" />
                    {yTicks.map((t, i) => {
                        const yy = 28 + (svgH - 28 - 22) - ((t - minY) / (maxY - minY || 1)) * (svgH - 28 - 22);
                        return (
                            <g key={i}>
                                <line x1={40} y1={yy} x2={40 + (svgW - 40 - 40)} y2={yy} stroke="#f1f5f9" />
                                <text x={34} y={yy + 3} fontSize="10" textAnchor="end" fill="#6b7280">
                                    {Math.round(t)}
                                </text>
                            </g>
                        );
                    })}
                    {labels.length > 0 && (
                        <>
                            <text x={40} y={28 + (svgH - 28 - 22) + 14} fontSize="9" textAnchor="start" fill="#6b7280">
                                {labels[0].slice(5).replace('-', '/')}
                            </text>
                            <text x={40 + (svgW - 40 - 40)} y={28 + (svgH - 28 - 22) + 14} fontSize="9" textAnchor="end" fill="#6b7280">
                                {labels[Math.max(0, labels.length - 1)].slice(5).replace('-', '/')}
                            </text>
                        </>
                    )}
                    {series.some((v) => v > 0) && path && <path d={path} fill="none" stroke="#16a34a" strokeWidth={2} />}
                    {series.map((v, i) =>
                        v > 0 ? (
                            <circle
                                key={i}
                                cx={40 + (i / Math.max(1, Math.max(1, labels.length - 1))) * (svgW - 40 - 40)}
                                cy={28 + (svgH - 28 - 22) - ((v - minY) / (maxY - minY || 1)) * (svgH - 28 - 22)}
                                r={2.4}
                                fill="#16a34a"
                            />
                        ) : null
                    )}
                    {hover && labels.length > 0 && (
                        <>
                            <line x1={hover.cx} y1={28} x2={hover.cx} y2={28 + (svgH - 28 - 22)} stroke="#e5e7eb" />
                            {hover.cy != null && <circle cx={hover.cx} cy={hover.cy} r={3.8} fill="white" stroke="#16a34a" strokeWidth={2} />}
                        </>
                    )}
                    <rect x={40} y={28} width={svgW - 40 - 40} height={svgH - 28 - 22} fill="transparent" />
                </svg>

                {/* Hover tooltip (date + value) */}
                {hover && labels.length > 0 && (
                    <div
                        ref={tipRef}
                        className="pointer-events-none absolute rounded-lg border bg-white px-3 py-2 text-[12px] shadow"
                        style={{ left: tooltipLeft, top: 120 }}
                    >
                        <div className="text-[11px] text-zinc-500">{labels[hover.i]}</div>
                        <div className="mt-1 inline-flex items-center gap-2">
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
                <div className="pointer-events-auto absolute inset-0 flex items-center justify-center gap-2">
                    {(['1W', '1M', '3M', '1Y', 'ALL'] as const).map((r) => (
                        <button
                            key={r}
                            className={`h-8 rounded-full px-3 text-sm ${r === range ? 'bg-black text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
                            onClick={() => setRange(r)}
                        >
                            {r}
                        </button>
                    ))}
                </div>

                {/* lbs/kg toggle pinned bottom-right */}
                <button
                    role="switch"
                    aria-checked={unit === 'kg'}
                    onClick={() => setUnit(unit === 'lbs' ? 'kg' : 'lbs')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex h-8 w-[96px] items-center rounded-full border bg-white p-1 text-xs shadow-sm hover:bg-zinc-50"
                    title="Toggle units"
                >
                    <span className={`z-10 flex-1 text-center ${unit === 'lbs' ? 'text-black' : 'text-zinc-500'}`}>lbs</span>
                    <span className={`z-10 flex-1 text-center ${unit === 'kg' ? 'text-black' : 'text-zinc-500'}`}>kg</span>
                    <span
                        className={`absolute left-1 top-1 h-6 w-10 rounded-full bg-zinc-200 transition-transform ${unit === 'kg' ? 'translate-x-[46px]' : 'translate-x-0'
                            }`}
                    />
                </button>
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
}: {
    width: number;
    height: number;
    valuesByDate: Record<string, number>;
    levels: number[];
    colors: string[];
    showAlternateDays?: boolean;
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

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
            {data.map((item, idx) => {
                const c = Math.floor(idx / 7);
                const r = idx % 7;
                const x = 8 + c * (cell + gap);
                const y = 8 + labelTop + r * (cell + gap);
                const li = levels.findIndex((t) => item.val <= t);
                const fill = colors[Math.max(0, li)];
                return <rect key={idx} x={x} y={y} width={cell} height={cell} rx="2" ry="2" fill={fill} />;
            })}

            {monthTicks.map((t, i) => {
                const x = 8 + t.col * (cell + gap) + cell / 2;
                return <text key={i} x={x} y={18} fontSize="10" textAnchor="middle" fill="#6b7280">{t.label}</text>;
            })}

            {dayLabels.map((lb, ix) => {
                const r = dayIndices[ix];
                const y = 8 + labelTop + r * (cell + gap) + cell * 0.7;
                const x = width - 26;
                return <text key={lb} x={x} y={y} fontSize="10" textAnchor="start" fill="#6b7280">{lb}</text>;
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
}: {
    valuesByDate: Record<string, number>;
    height: number;
    showAlternateDays?: boolean;
    levels: number[];
    colors: string[];
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
            />
        </div>
    );
}

/** ---------- small helpers ---------- */
function HeatmapLegend({ metric, levels }: { metric: HMMetric; levels: number[] }) {
    // levels = [0, t1, t2, t3, Infinity]
    const labels = [
        metric === 'kcal' ? '0 kcal' : '0 g',
        `≤${levels[1]}`,
        `≤${levels[2]}`,
        `≤${levels[3]}`,
        metric === 'kcal'
            ? `${Number.isFinite(levels[3]) ? `${levels[3]}+` : '3000+'}`
            : `${Number.isFinite(levels[3]) ? `${levels[3]}+` : '+'}`,
    ];
    return (
        <div className="mt-[-60px] flex flex-wrap items-center gap-6 text-[11px] text-zinc-600">
            <LegendItem label={labels[0]} color={COLORS[0]} />
            <LegendItem label={labels[1]} color={COLORS[1]} />
            <LegendItem label={labels[2]} color={COLORS[2]} />
            <LegendItem label={labels[3]} color={COLORS[3]} />
            <LegendItem label={labels[4]} color={COLORS[4]} />
        </div>
    );
}

function LegendItem({ label, color }: { label: string; color: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded" style={{ background: color }} />
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
    onSave: (m: Macro) => void;
    onClose: () => void;
}) {
    const [form, setForm] = useState<Macro>(initial);
    const field = 'h-10 w-full rounded-md border px-3 text-sm outline-none';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-3">
            <div className="w-full max-w-[480px] rounded-xl border bg-white p-4 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">Edit macro goals</h3>
                    <button className="rounded-md p-1 hover:bg-zinc-100" onClick={onClose} aria-label="Close"><X size={16} /></button>
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
                    <button className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50" onClick={onClose}>Cancel</button>
                    <button
                        className="rounded-md bg-black px-3 py-2 text-sm text-white hover:opacity-90"
                        onClick={() => onSave(form)}
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
    onSave: (levels: Record<HMMetric, number[]>) => void;
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
        onSave(next);
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
            <div className="w-full max-w-[540px] rounded-xl border bg-white p-4 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">Heatmap keys</h3>
                    <button className="rounded-md p-1 hover:bg-zinc-100" onClick={onClose} aria-label="Close"><X size={16} /></button>
                </div>

                {/* Minimal, compact grid */}
                <div className="rounded-lg border">
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
                    <button className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50" onClick={onClose}>Cancel</button>
                    <button className="rounded-md bg-black px-3 py-2 text-sm text-white hover:opacity-90" onClick={save}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
