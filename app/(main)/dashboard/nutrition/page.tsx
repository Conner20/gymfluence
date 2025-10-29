'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useMemo, useRef, useState, useEffect } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';

/** ---------- shared helpers ---------- */
function fmtDate(d: Date) {
    return d.toISOString().slice(0, 10);
}
function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}
function average(nums: number[]) {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

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

/** Demo foods */
const FOOD_DB: Food[] = [
    { id: '1', name: 'Grilled chicken (100g)', macros: { kcal: 165, p: 31, f: 3.6, c: 0 } },
    { id: '2', name: 'White rice (1 cup)', macros: { kcal: 205, p: 4.3, f: 0.4, c: 44.5 } },
    { id: '3', name: 'Avocado (1/2)', macros: { kcal: 120, p: 1.5, f: 11, c: 6 } },
    { id: '4', name: 'Greek yogurt (170g)', macros: { kcal: 100, p: 17, f: 0, c: 6 } },
    { id: '5', name: 'Oats (1/2 cup)', macros: { kcal: 150, p: 5, f: 3, c: 27 } },
];

/** ---------- page ---------- */
export default function Nutrition() {
    /** Macro goals */
    const goals: Macro = { kcal: 2800, p: 200, f: 80, c: 300 };

    /** Consumed state by meal */
    const [meals, setMeals] = useState<
        { meal: Meal; items: { food: Food; servings: number; time: string }[] }[]
    >([
        { meal: 'breakfast', items: [] },
        { meal: 'lunch', items: [] },
        { meal: 'dinner', items: [] },
        { meal: 'snack', items: [] },
    ]);

    /** Add-food UI state (lives inside the macros card) */
    const [q, setQ] = useState('');
    const [serv, setServ] = useState('1');
    const [targetMeal, setTargetMeal] = useState<Meal>('lunch');

    const addFood = (food: Food) => {
        const s = Math.max(0.25, parseFloat(serv || '1'));
        const time = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        setMeals((m) =>
            m.map((row) =>
                row.meal === targetMeal ? { ...row, items: [...row.items, { food, servings: s, time }] } : row
            )
        );
    };

    /** Remove a single food entry by meal/index */
    const removeFood = (meal: Meal, idx: number) => {
        setMeals((cur) =>
            cur.map((row) => (row.meal === meal ? { ...row, items: row.items.filter((_, i) => i !== idx) } : row))
        );
    };

    /** Totals */
    const consumed = useMemo(() => {
        const sum: Macro = { kcal: 0, p: 0, f: 0, c: 0 };
        for (const row of meals) {
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
    }, [meals]);

    /** Bodyweight data */
    const [bw, setBw] = useState<BWPoint[]>([]);
    const addBw = (d: string, weight: number) => {
        setBw((s) => {
            const rest = s.filter((p) => p.date !== d);
            return [...rest, { date: d, weight }].sort((a, b) => a.date.localeCompare(b.date));
        });
    };

    /** Heatmap values — start empty; renders all gray (0 kcal) */
    const valuesByDate = useMemo<Record<string, number>>(() => ({}), []);

    /** Layout */
    return (
        <div className="flex h-screen flex-col overflow-hidden bg-[#f8f8f8]">
            {/* Header */}
            <header className="flex w-full flex-none items-center justify-between bg-white px-[40px] py-5">
                <h1 className="select-none font-roboto text-3xl text-black tracking-tight">nutrition log</h1>
                <nav className="flex gap-2">
                    <Link href="/dashboard" className="px-6 py-2 text-black hover:underline">
                        workouts
                    </Link>
                    <Link href="/dashboard/wellness" className="px-6 py-2 text-black hover:underline">
                        wellness
                    </Link>
                    <Link href="/dashboard/nutrition" className="bg-black px-6 py-2 text-white">
                        nutrition
                    </Link>
                </nav>
            </header>

            {/* Content */}
            <div className="h-full w-full flex-1 overflow-hidden px-6 pb-4 pt-4">
                <div className="grid h-full min-w-0 grid-cols-12 gap-6">
                    {/* LEFT column — Macros flip card */}
                    <section className="col-span-4 min-h-0">
                        <MacrosFlipCard
                            goals={goals}
                            consumed={consumed}
                            meals={meals}
                            addUI={{ q, setQ, serv, setServ, targetMeal, setTargetMeal, addFood }}
                        />
                    </section>

                    {/* MIDDLE column — Bodyweight + Heatmap (responsive) */}
                    <section className="col-span-5 min-h-0">
                        <div className="flex h-full min-h-0 flex-col gap-3">
                            {/* Bodyweight */}
                            <div className="relative min-h-0 flex-[60] rounded-xl border bg-white p-3 shadow-sm">
                                <BWChartLiftsStyle points={bw} onAdd={(d, w) => addBw(d, w)} />
                            </div>

                            {/* 2025 calories heatmap — header fixed at top, legend fixed at bottom, heatmap truly centered */}
                            <div className="min-h-0 flex flex-[40] flex-col rounded-xl border bg-white p-3 shadow-sm">
                                <div className="mb-1 flex items-center justify-between">
                                    <h3 className="font-semibold">2025 calories</h3>
                                    <div className="text-[11px] text-zinc-500">kcal per day</div>
                                </div>

                                {/* Middle area grows; heatmap centered vertically within it */}
                                <div className="flex flex-1 items-center justify-center">
                                    <ResponsiveHeatmap valuesByDate={valuesByDate} height={180} showAlternateDays />
                                </div>

                                {/* Legend anchored to bottom, with comfortable spacing between items */}
                                <div className="pt-3 flex flex-wrap items-center gap-6 text-[11px] text-zinc-600">
                                    <LegendItem label="0 kcal" color="#e5e7eb" />
                                    <LegendItem label="≤2200" color="#d1fae5" />
                                    <LegendItem label="≤2600" color="#a7f3d0" />
                                    <LegendItem label="≤3000" color="#6ee7b7" />
                                    <LegendItem label="3000+" color="#34d399" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* RIGHT column — Today’s meals (full height) */}
                    <section className="col-span-3 min-h-0">
                        <div className="flex h-full min-h-0 flex-col">
                            <div className="min-h-0 flex-1 rounded-xl border bg-white p-3 shadow-sm">
                                <h3 className="mb-2 font-semibold">Today&apos;s meals</h3>
                                <div className="h-[calc(100%-36px)] space-y-3 overflow-y-auto pr-1">
                                    {meals.map((row) => (
                                        <div key={row.meal}>
                                            <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{row.meal}</div>
                                            <ul className="space-y-1">
                                                {row.items.length === 0 ? (
                                                    <li className="text-sm text-zinc-400">—</li>
                                                ) : (
                                                    row.items.map((it, i) => (
                                                        <li key={i} className="flex items-center justify-between text-sm">
                                                            <span className="min-w-0 truncate">{it.food.name}</span>
                                                            <span className="ml-2 flex items-center gap-3 text-zinc-500">
                                                                <span>
                                                                    {it.servings}× • {(it.food.macros.kcal * it.servings) | 0} kcal • {it.time}
                                                                </span>
                                                                <button
                                                                    aria-label="Delete"
                                                                    className="p-1 text-zinc-500 hover:text-red-600"
                                                                    onClick={() => removeFood(row.meal, i)}
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

            <Navbar />
        </div>
    );
}

/** ---------- Flip card (Today's macros ↔ Add food) ---------- */
function MacrosFlipCard({
    goals,
    consumed,
    meals,
    addUI,
}: {
    goals: Macro;
    consumed: Macro;
    meals: { meal: Meal; items: { food: Food; servings: number; time: string }[] }[];
    addUI: {
        q: string;
        setQ: (v: string) => void;
        serv: string;
        setServ: (v: string) => void;
        targetMeal: Meal;
        setTargetMeal: (m: Meal) => void;
        addFood: (food: Food) => void;
    };
}) {
    const [flipped, setFlipped] = useState(false);

    return (
        <div className="h-full rounded-xl border bg-white shadow-sm [perspective:1200px]">
            {/* toolbar */}
            <div className="flex items-center justify-between px-4 pt-4">
                <h3 className="font-semibold">Today&apos;s macros</h3>
                <button
                    aria-label={flipped ? 'Close add food' : 'Add food'}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${flipped ? 'bg-neutral-200 text-black' : 'bg-black text-white'
                        } hover:opacity-90`}
                    onClick={() => setFlipped((v) => !v)}
                    title={flipped ? 'Close' : 'Add food'}
                >
                    {flipped ? <X size={16} /> : <Plus size={16} />}
                </button>
            </div>

            {/* flip container */}
            <div
                className={`relative h-[calc(100%-48px)] w-full transition-transform duration-300 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''
                    }`}
            >
                {/* FRONT — Rings grid; centered & NO borders on tiles */}
                <div className="absolute inset-0 backface-hidden p-4">
                    <div className="flex h-full items-center justify-center">
                        <div className="grid w-full grid-cols-2 place-items-center gap-4 md:gap-6">
                            <RingBig label="calories (kcal)" value={consumed.kcal} goal={goals.kcal} color="#ef4444" />
                            <RingBig label="protein (g)" value={consumed.p} goal={goals.p} color="#3b82f6" />
                            <RingBig label="fat (g)" value={consumed.f} goal={goals.f} color="#f59e0b" />
                            <RingBig label="carbs (g)" value={consumed.c} goal={goals.c} color="#8b5cf6" />
                        </div>
                    </div>
                </div>

                {/* BACK — Add food UI (rotated) */}
                <div className="absolute inset-0 overflow-hidden p-4 [transform:rotateY(180deg)] backface-hidden">
                    <AddFoodPanel meals={meals} {...addUI} />
                </div>
            </div>
        </div>
    );
}

/** Rings styled to match screenshot; NO border around each ring tile */
function RingBig({
    label,
    value,
    goal,
    color,
}: {
    label: string;
    value: number;
    goal: number;
    color: string;
}) {
    const pct = Math.min(1, value / Math.max(1, goal));
    const R = 80;
    const C = 2 * Math.PI * R;

    return (
        <div className="relative flex items-center justify-center bg-white p-2">
            {/* Scales responsively; no outline */}
            <svg viewBox="0 0 220 220" className="aspect-square w-full max-w-[200px]">
                <circle cx="110" cy="110" r={R} stroke="#e5e7eb" strokeWidth="10" fill="none" strokeLinecap="round" />
                <circle
                    cx="110"
                    cy="110"
                    r={R}
                    stroke={color}
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${C * pct},999`}
                    transform="rotate(-90 110 110)"
                />
            </svg>
            <div className="absolute text-center">
                <div className="text-xl md:text-2xl font-semibold">
                    {value} / {goal}
                </div>
                <div className="text-xs md:text-sm text-neutral-500">{label}</div>
            </div>
        </div>
    );
}

/** Back face: Add food with per-meal metric toggle */
function AddFoodPanel({
    q,
    setQ,
    serv,
    setServ,
    targetMeal,
    setTargetMeal,
    addFood,
    meals,
}: {
    q: string;
    setQ: (v: string) => void;
    serv: string;
    setServ: (v: string) => void;
    targetMeal: Meal;
    setTargetMeal: (m: Meal) => void;
    addFood: (food: Food) => void;
    meals: { meal: Meal; items: { food: Food; servings: number; time: string }[] }[];
}) {
    type Metric = 'kcal' | 'p' | 'c' | 'f';
    const [metric, setMetric] = useState<Metric>('kcal');

    const unitLabel = metric === 'kcal' ? 'kcal' : metric === 'p' ? 'g protein' : metric === 'c' ? 'g carbs' : 'g fat';

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2">
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search foods…"
                    className="flex-1 rounded-lg border px-3 py-2"
                />
                <select
                    className="rounded-lg border px-2 py-2 text-sm"
                    value={targetMeal}
                    onChange={(e) => setTargetMeal(e.target.value as Meal)}
                >
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
                        <option key={m} value={m}>
                            {m}
                        </option>
                    ))}
                </select>
                {/* fixed/narrower width so it never clips on the right */}
                <input
                    type="number"
                    min={0.25}
                    step="0.25"
                    value={serv}
                    onChange={(e) => setServ(e.target.value)}
                    className="w-[64px] sm:w-[64px] rounded-lg border px-2 py-2 text-sm"
                    placeholder="servings"
                />
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border">
                <ul className="divide-y">
                    {FOOD_DB.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).map((f) => (
                        <li key={f.id} className="flex items-center justify-between p-3">
                            <div className="min-w-0">
                                <div className="truncate font-medium">{f.name}</div>
                                <div className="text-xs text-zinc-500">
                                    {f.macros.kcal} kcal • P {f.macros.p} • F {f.macros.f} • C {f.macros.c}
                                </div>
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
                            className={`rounded-md px-3 py-1 capitalize ${metric === m ? 'bg-black text-white' : 'text-neutral-700 hover:bg-neutral-100'
                                }`}
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
                            <div className="text-zinc-700">
                                {mealMetric(m, meals, metric)} {unitLabel}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** ---------- Bodyweight chart (responsive, centered) + Add button BELOW; header text stable ---------- */
function BWChartLiftsStyle({
    points,
    onAdd,
}: {
    points: BWPoint[];
    onAdd: (dateISO: string, weight: number) => void;
}) {
    const [range, setRange] = useState<RangeKey>('1M');

    // responsive width/height — taller & wider
    const { ref, width } = useMeasure<HTMLDivElement>();
    const svgW = Math.max(770, Math.floor(width)); // nearly full card width
    const svgH = 380; // taller

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

    const series = useMemo(
        () =>
            labels.map((d) => {
                const vals = byDate[d] || [];
                return vals.length ? average(vals) : 0;
            }),
        [labels, byDate]
    );

    const left = 40,
        right = 40,
        top = 28,
        bottom = 22;
    const w = svgW - left - right,
        h = svgH - top - bottom;

    const hasAnyValue = series.some((v) => v > 0);
    const minY = hasAnyValue ? Math.min(...series.filter((v) => v > 0), 0) : 100;
    const maxY = hasAnyValue ? Math.max(...series, Math.max(1, minY + 1)) : 200;

    const y = (v: number) => top + h - ((v - minY) / (maxY - minY || 1)) * h;
    const x = (i: number) => left + (i / Math.max(1, Math.max(1, labels.length - 1))) * w;

    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minY + ((maxY - minY) * i) / ticks);

    const mkPath = (arr: number[]) => {
        let started = false,
            d = '';
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

    // Add button (expands left). Keep LEFT text steady by reserving fixed width for controls.
    const [openAdd, setOpenAdd] = useState(false);
    const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [newW, setNewW] = useState<string>('');
    const expanderCls =
        'overflow-hidden transition-all duration-200 ease-out whitespace-nowrap flex items-center gap-2';

    const title =
        range === '1W'
            ? "This week's bodyweight"
            : range === '1M'
                ? "This month's bodyweight"
                : range === '3M'
                    ? "Past three months' bodyweight"
                    : range === '1Y'
                        ? "This year's bodyweight"
                        : 'Your bodyweight';

    return (
        <div className="relative flex h-full w-full flex-col" ref={ref}>
            {/* header line with add (title won't wrap) */}
            <div className="mb-1 flex items-center justify-between">
                <div className="min-w-0">
                    <h3 className="font-semibold whitespace-nowrap">{title}</h3>
                    <div className="text-xs text-zinc-600">lbs</div>
                </div>

                {/* Fixed-width, non-shrinking controls to prevent left text from shifting */}
                <div className="flex w-[400px] shrink-0 items-center justify-end">
                    <div className={`${expanderCls} ${openAdd ? 'mr-2 max-w-[360px] opacity-100' : 'mr-0 max-w-0 opacity-0'}`}>
                        <input
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="h-8 rounded-lg border px-2 text-sm outline-none"
                        />
                        <input
                            placeholder="weight"
                            inputMode="decimal"
                            className="h-8 w-24 rounded-lg border px-2 text-sm outline-none"
                            value={newW}
                            onChange={(e) => setNewW(e.target.value)}
                        />
                        <button
                            className="h-8 rounded-lg bg-green-600 px-3 text-sm text-white hover:bg-green-700"
                            onClick={() => {
                                const n = parseFloat(newW);
                                if (!isFinite(n) || n <= 0) return;
                                onAdd(newDate, n);
                                setNewW('');
                                setOpenAdd(false);
                            }}
                        >
                            Add
                        </button>
                    </div>
                    <button
                        aria-label="Add bodyweight"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700"
                        onClick={() => setOpenAdd((v) => !v)}
                        title="Add bodyweight"
                    >
                        {openAdd ? <X size={16} /> : <Plus size={16} />}
                    </button>
                </div>
            </div>

            {/* CHART AREA — centered, with reserved space below for buttons */}
            <div className="flex min-h-0 flex-1 items-center justify-center pb-4">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="h-[100%] w-[100%] select-none"
                    onMouseMove={onMove}
                    onMouseLeave={onLeave}
                >
                    {/* axes & grid */}
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

                    {/* x labels */}
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

                    {/* series */}
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

                    {/* hover */}
                    {hover && labels.length > 0 && (
                        <>
                            <line x1={hover.cx} y1={28} x2={hover.cx} y2={28 + (svgH - 28 - 22)} stroke="#e5e7eb" />
                            {hover.cy != null && <circle cx={hover.cx} cy={hover.cy} r={3.8} fill="white" stroke="#16a34a" strokeWidth={2} />}
                        </>
                    )}
                    <rect x={40} y={28} width={svgW - 40 - 40} height={svgH - 28 - 22} fill="transparent" />
                </svg>
            </div>

            {/* Range buttons — BELOW the chart, with spacing */}
            <div className="mt-2 flex items-center justify-center gap-2">
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

            {/* floating tooltip */}
            {hover && labels.length > 0 && (
                <div
                    ref={tipRef}
                    className="pointer-events-none absolute left-1/2 top-[120px] -translate-x-1/2 rounded-lg border bg-white px-3 py-2 text-[12px] shadow"
                >
                    <div className="text-[11px] text-zinc-500">{labels[hover.i]}</div>
                    <div className="mt-1 inline-flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#16a34a' }} />
                        <span className="font-medium">{series[hover.i] ? `${series[hover.i].toFixed(1)} lbs` : '—'}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

/** ---------- Heatmap (always renders; gray when empty) ---------- */
function YearHeatmapCalories({
    width,
    height,
    valuesByDate,
    showAlternateDays = false,
}: {
    width: number;
    height: number;
    valuesByDate: Record<string, number>;
    showAlternateDays?: boolean;
}) {
    const cols = 53,
        rows = 7,
        pad = 8,
        labelTop = 14,
        // give a little more room on the right for labels
        labelRight = 30,
        gap = 1.8;
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

    const levels = [0, 2200, 2600, 3000, Infinity];
    const colors = ['#e5e7eb', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399'];

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
                return (
                    <text key={i} x={x} y={18} fontSize="10" textAnchor="middle" fill="#6b7280">
                        {t.label}
                    </text>
                );
            })}

            {dayLabels.map((lb, ix) => {
                const r = dayIndices[ix];
                const y = 8 + labelTop + r * (cell + gap) + cell * 0.7;
                const x = width - 26;
                return (
                    <text key={lb} x={x} y={y} fontSize="10" textAnchor="start" fill="#6b7280">
                        {lb}
                    </text>
                );
            })}
        </svg>
    );
}

/** Responsive wrapper for heatmap width – stays centered vertically where used */
function ResponsiveHeatmap({
    valuesByDate,
    height,
    showAlternateDays = false,
}: {
    valuesByDate: Record<string, number>;
    height: number;
    showAlternateDays?: boolean;
}) {
    const { ref, width } = useMeasure<HTMLDivElement>();
    const w = Math.max(420, Math.floor(width));
    return (
        <div ref={ref} className="h-[180px] w-full">
            <YearHeatmapCalories width={w} height={height} valuesByDate={valuesByDate} showAlternateDays={showAlternateDays} />
        </div>
    );
}

/** ---------- small helpers ---------- */
function LegendItem({ label, color }: { label: string; color: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded" style={{ background: color }} />
            <span>{label}</span>
        </div>
    );
}

/** meal totals by metric */
function mealMetric(
    meal: Meal,
    meals: { meal: Meal; items: { food: Food; servings: number }[] }[],
    metric: 'kcal' | 'p' | 'c' | 'f'
) {
    const items = meals.find((m) => m.meal === meal)?.items || [];
    const total = items.reduce((acc, it) => acc + (it.food.macros[metric] as number) * it.servings, 0);
    return Math.round(total);
}

/** legacy kcal helper (used in Today’s meals text) */
function mealKcal(meal: Meal, meals: { meal: Meal; items: { food: Food; servings: number; time: string }[] }[]) {
    return Math.round(
        (meals.find((m) => m.meal === meal)?.items || []).reduce(
            (acc, it) => acc + it.food.macros.kcal * it.servings,
            0
        )
    );
}
