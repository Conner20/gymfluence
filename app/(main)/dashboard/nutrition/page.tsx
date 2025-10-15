'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';

type Macro = { kcal: number; p: number; f: number; c: number };
type Food = { id: string; name: string; macros: Macro };
type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type BWPoint = { date: string; weight: number };

const FOOD_DB: Food[] = [
    { id: '1', name: 'Grilled chicken (100g)', macros: { kcal: 165, p: 31, f: 3.6, c: 0 } },
    { id: '2', name: 'White rice (1 cup)', macros: { kcal: 205, p: 4.3, f: 0.4, c: 44.5 } },
    { id: '3', name: 'Avocado (1/2)', macros: { kcal: 120, p: 1.5, f: 11, c: 6 } },
    { id: '4', name: 'Greek yogurt (170g)', macros: { kcal: 100, p: 17, f: 0, c: 6 } },
    { id: '5', name: 'Oats (1/2 cup)', macros: { kcal: 150, p: 5, f: 3, c: 27 } },
];

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

    /** Cart add (from search) */
    const [q, setQ] = useState('');
    const [serv, setServ] = useState('1');
    const [targetMeal, setTargetMeal] = useState<Meal>('lunch');

    const addFood = (food: Food) => {
        const s = Math.max(0.25, parseFloat(serv || '1'));
        const time = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        setMeals((m) =>
            m.map((row) =>
                row.meal === targetMeal
                    ? { ...row, items: [...row.items, { food, servings: s, time }] }
                    : row
            )
        );
    };

    /** Sums */
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

    /** Bodyweight */
    const [bw, setBw] = useState<BWPoint[]>(
        Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return { date: d.toISOString().slice(0, 10), weight: 175 + Math.sin(i) * 3 };
        })
    );
    const addBw = (d: string, weight: number) => {
        setBw((s) => {
            const rest = s.filter((p) => p.date !== d);
            return [...rest, { date: d, weight }].sort((a, b) => a.date.localeCompare(b.date));
        });
    };

    /** Heatmap calories (year) */
    const year = new Date().getFullYear();
    const heat: Record<string, number> = {};
    for (let i = 0; i < 180; i++) {
        const dt = new Date(year, 0, 1);
        dt.setDate(dt.getDate() + i);
        heat[dt.toISOString().slice(0, 10)] = 2000 + Math.round(Math.random() * 1600);
    }

    /** Pie per meal (kcal) */
    const mealKcal = (meal: Meal) =>
        Math.round(
            meals
                .find((m) => m.meal === meal)!
                .items.reduce((acc, it) => acc + it.food.macros.kcal * it.servings, 0)
        );

    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <header className="flex w-full items-center justify-between bg-white px-[40px] py-5">
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

            <div className="mx-auto max-w-[1400px] p-6 grid grid-cols-12 gap-6">
                {/* Left: Macro dashboard + food add */}
                <section className="col-span-12 lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-2xl border shadow-sm p-4">
                        <h3 className="font-semibold mb-4">Today&apos;s macros</h3>
                        <div className="grid grid-cols-2 gap-6">
                            <Ring label="calories (kcal)" value={consumed.kcal} goal={goals.kcal} color="#ef4444" />
                            <Ring label="protein (g)" value={consumed.p} goal={goals.p} color="#3b82f6" />
                            <Ring label="fat (g)" value={consumed.f} goal={goals.f} color="#f59e0b" />
                            <Ring label="carbs (g)" value={consumed.c} goal={goals.c} color="#8b5cf6" />
                        </div>
                    </div>

                    {/* Add food */}
                    <div className="bg-white rounded-2xl border shadow-sm p-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Add food</h3>
                            <span className="text-xs text-zinc-500">subtracts from remaining</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search foods…"
                                className="flex-1 border rounded-lg px-3 py-2"
                            />
                            <select
                                className="border rounded-lg px-2 py-2 text-sm"
                                value={targetMeal}
                                onChange={(e) => setTargetMeal(e.target.value as Meal)}
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
                                className="w-24 border rounded-lg px-2 py-2 text-sm"
                                placeholder="servings"
                            />
                        </div>

                        <ul className="mt-3 divide-y rounded-lg border overflow-hidden">
                            {FOOD_DB.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).map((f) => (
                                <li key={f.id} className="p-3 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{f.name}</div>
                                        <div className="text-xs text-zinc-500">
                                            {f.macros.kcal} kcal • P {f.macros.p} • F {f.macros.f} • C {f.macros.c}
                                        </div>
                                    </div>
                                    <button
                                        className="p-2 rounded-full border hover:bg-zinc-50"
                                        onClick={() => addFood(f)}
                                        title="Add"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Middle: Bodyweight trend */}
                <section className="col-span-12 lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-2xl border shadow-sm p-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Body weight trend</h3>
                            <AddBW onAdd={addBw} />
                        </div>
                        <BWChart points={bw} />
                    </div>

                    <div className="bg-white rounded-2xl border shadow-sm p-4">
                        <h3 className="font-semibold mb-2">2025 calories</h3>
                        <YearHeatmap values={heat} />
                    </div>
                </section>

                {/* Right: Pie + meal list */}
                <section className="col-span-12 lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-2xl border shadow-sm p-4">
                        <h3 className="font-semibold mb-2">calories • per meal</h3>
                        <Pie
                            slices={[
                                { label: 'breakfast', value: mealKcal('breakfast'), color: '#ef4444' },
                                { label: 'lunch', value: mealKcal('lunch'), color: '#22c55e' },
                                { label: 'dinner', value: mealKcal('dinner'), color: '#3b82f6' },
                                { label: 'snack', value: mealKcal('snack'), color: '#f59e0b' },
                            ]}
                        />
                        <ul className="mt-3 text-sm text-zinc-700 space-y-1">
                            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
                                <li key={m} className="flex justify-between">
                                    <span className="capitalize">{m}</span>
                                    <span className="text-zinc-500">{mealKcal(m)} kcal</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-white rounded-2xl border shadow-sm p-4">
                        <h3 className="font-semibold mb-2">Today&apos;s meals</h3>
                        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                            {meals.map((row) => (
                                <div key={row.meal}>
                                    <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{row.meal}</div>
                                    <ul className="space-y-1">
                                        {row.items.length === 0 ? (
                                            <li className="text-zinc-400 text-sm">—</li>
                                        ) : (
                                            row.items.map((it, i) => (
                                                <li key={i} className="text-sm flex justify-between">
                                                    <span>{it.food.name}</span>
                                                    <span className="text-zinc-500">
                                                        {it.servings}× • {it.food.macros.kcal * it.servings | 0} kcal • {it.time}
                                                    </span>
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            <Navbar />
        </div>
    );
}

/** ----- components ----- */
function Ring({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
    const pct = Math.min(1, value / goal);
    const R = 56;
    const C = 2 * Math.PI * R;
    return (
        <div className="flex items-center justify-center gap-4">
            <svg viewBox="0 0 140 140" className="w-32 h-32">
                <circle cx="70" cy="70" r={R} stroke="#e5e7eb" strokeWidth="14" fill="none" />
                <circle
                    cx="70"
                    cy="70"
                    r={R}
                    stroke={color}
                    strokeWidth="14"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${C * pct},999`}
                    transform="rotate(-90 70 70)"
                />
                <text x="70" y="72" textAnchor="middle" fontSize="18" fontWeight="600">
                    {value} / {goal}
                </text>
            </svg>
            <div>
                <div className="text-xs text-zinc-500">{label}</div>
            </div>
        </div>
    );
}

function AddBW({ onAdd }: { onAdd: (d: string, w: number) => void }) {
    const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [w, setW] = useState<string>('178');
    return (
        <div className="flex items-center gap-2">
            <input className="border rounded-lg px-2 py-1 text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className="w-24 border rounded-lg px-2 py-1 text-sm" type="number" step="0.1" value={w} onChange={(e) => setW(e.target.value)} />
            <button className="p-2 rounded-full border hover:bg-zinc-50" onClick={() => onAdd(date, parseFloat(w || '0'))} title="Add bodyweight">
                <Plus size={16} />
            </button>
        </div>
    );
}

function BWChart({ points }: { points: BWPoint[] }) {
    const W = 520, H = 240, pad = 36;
    const max = Math.max(...points.map((p) => p.weight), 100);
    const min = Math.min(...points.map((p) => p.weight), 80);
    const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (W - pad * 2);
    const y = (v: number) => H - pad - ((v - min) / Math.max(1, max - min)) * (H - pad * 2);
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)},${y(p.weight)}`).join(' ');

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2">
            {[0.25, 0.5, 0.75].map((t) => (
                <line key={t} x1={pad} x2={W - pad} y1={pad + (1 - t) * (H - pad * 2)} y2={pad + (1 - t) * (H - pad * 2)} stroke="#eee" />
            ))}
            <path d={d} stroke="#22c55e" fill="none" strokeWidth={2} />
            {points.map((p, i) => (
                <circle key={p.date} cx={x(i)} cy={y(p.weight)} r={3} fill="#22c55e">
                    <title>{p.weight.toFixed(1)} lbs • {new Date(p.date).toLocaleDateString()}</title>
                </circle>
            ))}
        </svg>
    );
}

function YearHeatmap({ values }: { values: Record<string, number> }) {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const weeks = 54; const size = 10; const gap = 2;
    const col = (v: number) => {
        if (!v) return '#eef2ff';
        if (v < 2200) return '#e5e7eb';
        if (v < 2600) return '#bbf7d0';
        if (v < 3000) return '#86efac';
        if (v < 3400) return '#4ade80';
        return '#22c55e';
    };
    const cells: { x: number; y: number; d: Date; v: number }[] = [];
    for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
            const dt = new Date(start); dt.setDate(start.getDate() + (w * 7 + d - start.getDay()));
            if (dt.getFullYear() !== year) continue;
            const key = dt.toISOString().slice(0, 10);
            cells.push({ x: w * (size + gap), y: d * (size + gap), d: dt, v: values[key] ?? 0 });
        }
    }
    const W = weeks * (size + gap), H = 7 * (size + gap);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {cells.map((c) => (
                <rect key={c.d.toISOString()} x={c.x} y={c.y} width={size} height={size} rx={2} ry={2} fill={col(c.v)}>
                    <title>{c.v} kcal • {c.d.toDateString()}</title>
                </rect>
            ))}
        </svg>
    );
}

function Pie({ slices }: { slices: { label: string; value: number; color: string }[] }) {
    const total = slices.reduce((a, b) => a + b.value, 0) || 1;
    const R = 56, C = 2 * Math.PI * R;
    let acc = 0;
    return (
        <svg viewBox="0 0 140 140" className="w-40 h-40">
            <circle cx="70" cy="70" r={R} stroke="#f1f5f9" strokeWidth="18" fill="none" />
            {slices.map((s, i) => {
                const len = (s.value / total) * C;
                const circ = (
                    <circle
                        key={s.label}
                        cx="70" cy="70" r={R}
                        stroke={s.color}
                        strokeWidth="18" fill="none"
                        strokeDasharray={`${len},999`}
                        transform={`rotate(${(acc / C) * 360 - 90} 70 70)`}
                        strokeLinecap="butt"
                    />
                );
                acc += len;
                return circ;
            })}
        </svg>
    );
}
