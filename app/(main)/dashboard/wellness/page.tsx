// app/(main)/dashboard/wellness/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Moon, Droplet, Flame, Plus, X } from 'lucide-react';

/* utils */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const fmtISO = (d: Date) => d.toISOString().slice(0, 10);

type SleepPoint = { date: string; hours: number | null };
type WaterPoint = { date: string; liters: number };

function useLocalArray<T>(key: string, initial: T[]) {
    const [value, setValue] = useState<T[]>(() => {
        if (typeof window === 'undefined') return initial;
        try {
            const raw = localStorage.getItem(key);
            return raw ? (JSON.parse(raw) as T[]) : initial;
        } catch {
            return initial;
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch { }
    }, [key, value]);
    return [value, setValue] as const;
}

const AxisLabel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <span className={`text-[11px] text-neutral-500 ${className}`}>{children}</span>
);
const Dot = ({ cx, cy, r = 3, color = '#a855f7' }: { cx: number; cy: number; r?: number; color?: string }) => (
    <circle cx={cx} cy={cy} r={r} fill={color} stroke="white" strokeWidth={1} />
);

/* ------------------------------- Sleep chart ------------------------------ */
function SleepLine({
    data,
    range,
    onAdd,
    onRange,
}: {
    data: SleepPoint[];
    range: '1W' | '1M' | '3M' | '1Y';
    onAdd: (pt: SleepPoint) => void;
    onRange: (r: '1W' | '1M' | '3M' | '1Y') => void;
}) {
    const svgRef = useRef<SVGSVGElement>(null);

    const days = range === '1W' ? 7 : range === '1M' ? 30 : range === '3M' ? 90 : 365;
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));

    const xs = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach((d) => {
            if (d.hours != null && isFinite(d.hours)) map.set(d.date, d.hours);
        });
        const arr: SleepPoint[] = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const iso = fmtISO(d);
            const v = map.has(iso) ? map.get(iso)! : null;
            arr.push({ date: iso, hours: v });
        }
        return arr;
    }, [data, days]);

    // drawing box
    const W = 780;
    const H = 290;
    const pad = { top: 20, right: 20, bottom: 20, left: 44 };
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;

    const yMin = 6.5;
    const yMax = 10;
    const y = (hrs: number) => pad.top + innerH - ((hrs - yMin) / (yMax - yMin)) * innerH;
    const x = (i: number) => pad.left + (i / Math.max(1, xs.length - 1)) * innerW;

    // Build a path that CONNECTS all non-null points (bridges gaps over nulls).
    const nonNull = useMemo(
        () =>
            xs
                .map((p, i) => (p.hours != null ? { i, hours: p.hours } : null))
                .filter((p): p is { i: number; hours: number } => p !== null),
        [xs]
    );

    const pathD = useMemo(() => {
        if (nonNull.length < 2) return '';
        let d = `M ${x(nonNull[0].i)} ${y(nonNull[0].hours)}`;
        for (let k = 1; k < nonNull.length; k++) d += ` L ${x(nonNull[k].i)} ${y(nonNull[k].hours)}`;
        return d;
    }, [nonNull]);

    const [hover, setHover] = useState<{ i: number; cx: number; cy: number } | null>(null);
    const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const localX = clamp(e.clientX - rect.left, pad.left, pad.left + innerW);
        const ratio = (localX - pad.left) / innerW;
        const i = Math.round(ratio * (xs.length - 1));
        const safeI = clamp(i, 0, xs.length - 1);
        const h = xs[safeI].hours ?? yMin;
        setHover({ i: safeI, cx: x(safeI), cy: y(h as number) });
    };

    const avg7 = useMemo(() => {
        const last = xs.slice(-7);
        const vals = last.map((p) => p.hours).filter((v): v is number => v != null && isFinite(v));
        if (vals.length === 0) return 0;
        const sum = vals.reduce((a, b) => a + b, 0);
        return sum / vals.length;
    }, [xs]);

    const [openAdd, setOpenAdd] = useState(false);
    const [newDate, setNewDate] = useState(fmtISO(new Date()));
    const [newHours, setNewHours] = useState('');

    const expanderCls =
        'overflow-hidden transition-all duration-200 ease-out whitespace-nowrap flex items-center gap-2';

    return (
        <div className="relative h-full w-full overflow-hidden rounded-xl border bg-white p-4 shadow-sm">
            {/* header */}
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold">Sleep trend</h3>
                    <div className="text-[11px] text-green-600">avg last 7 days: {avg7.toFixed(1)} hrs</div>
                    <div className="mt-1 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-700">
                            <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
                            Sleep (hrs)
                        </span>
                        <span className="text-xs text-neutral-400">· {range}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {(['1W', '1M', '3M', '1Y'] as const).map((r) => (
                        <button
                            key={r}
                            className={`h-8 rounded-full px-3 text-sm ${r === range ? 'bg-black text-white' : 'text-neutral-700 hover:bg-neutral-100'
                                }`}
                            onClick={() => onRange(r)}
                        >
                            {r}
                        </button>
                    ))}

                    <button
                        aria-label="Add sleep"
                        className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                        onClick={() => setOpenAdd((v) => !v)}
                    >
                        {openAdd ? <X size={16} /> : <Plus size={16} />}
                    </button>

                    {/* INLINE expander to the right of + button */}
                    <div className={`${expanderCls} ${openAdd ? 'max-w-[420px] opacity-100 ml-2' : 'max-w-0 opacity-0 ml-0'}`}>
                        <input
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="h-8 rounded-lg border px-2 text-sm outline-none"
                        />
                        <input
                            placeholder="hrs"
                            inputMode="decimal"
                            className="h-8 w-20 rounded-lg border px-2 text-sm outline-none"
                            value={newHours}
                            onChange={(e) => setNewHours(e.target.value)}
                        />
                        <button
                            className="h-8 rounded-lg bg-purple-600 px-3 text-sm text-white hover:bg-purple-700"
                            onClick={() => {
                                const h = parseFloat(newHours);
                                if (!isFinite(h) || h <= 0) return;
                                onAdd({ date: newDate, hours: clamp(h, 0, 24) });
                                setNewHours('');
                                setOpenAdd(false);
                            }}
                        >
                            Add
                        </button>
                    </div>
                </div>
            </div>

            {/* chart */}
            <div className="relative mt-3 w-full overflow-hidden">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${W} ${H}`}
                    className="h-[270px] w-full"
                    onMouseMove={onMove}
                    onMouseLeave={() => setHover(null)}
                >
                    {[10, 9, 8, 7].map((h) => (
                        <g key={h}>
                            <line x1={pad.left} x2={W - pad.right} y1={y(h)} y2={y(h)} stroke="#eee" strokeWidth={1} />
                            <text x={pad.left - 8} y={y(h) + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
                                {h.toFixed(1)}
                            </text>
                        </g>
                    ))}

                    {/* CONNECTED polyline through non-null points */}
                    {pathD && <path d={pathD} fill="none" stroke="#a855f7" strokeWidth={2} />}

                    {/* light area fill only when 2+ points exist */}
                    {nonNull.length >= 2 && (
                        <path
                            d={`${pathD} L ${pad.left + innerW} ${pad.top + innerH} L ${pad.left} ${pad.top + innerH} Z`}
                            fill="#a855f71a"
                        />
                    )}

                    {/* dots only on recorded days */}
                    {xs.map((p, i) => (p.hours != null ? <Dot key={i} cx={x(i)} cy={y(p.hours)} /> : null))}

                    {/* hover guide */}
                    {hover && (
                        <>
                            <line x1={hover.cx} x2={hover.cx} y1={pad.top} y2={pad.top + innerH} stroke="#d1d5db" strokeDasharray="4 4" />
                            {xs[hover.i].hours != null && <Dot cx={hover.cx} cy={y(xs[hover.i].hours!)} r={4} color="#7c3aed" />}
                        </>
                    )}

                    {/* x labels inside */}
                    <text x={pad.left + 2} y={pad.top + innerH + 18} fontSize="10" fill="#9ca3af" textAnchor="start">
                        {xs[0]?.date ?? ''}
                    </text>
                    <text x={pad.left + innerW - 2} y={pad.top + innerH + 18} fontSize="10" fill="#9ca3af" textAnchor="end">
                        {xs.at(-1)?.date ?? ''}
                    </text>
                </svg>

                {/* tooltip that auto-flips left and nudges up if near bottom */}
                {hover && (
                    <TooltipFlip
                        cx={hover.cx}
                        cy={hover.cy}
                        chartW={W}
                        chartH={H}
                        pad={pad}
                        content={
                            <div className="leading-tight">
                                <div className="font-medium">{xs[hover.i].date}</div>
                                <div>{xs[hover.i].hours != null ? `${xs[hover.i].hours.toFixed(1)} hrs` : '—'}</div>
                            </div>
                        }
                    />
                )}
            </div>
        </div>
    );
}

/** Tooltip helper that flips to the left near the right edge and stays inside the chart vertically */
function TooltipFlip({
    cx,
    cy,
    chartW,
    chartH,
    pad,
    content,
}: {
    cx: number;
    cy: number;
    chartW: number;
    chartH: number;
    pad: { top: number; right: number; bottom: number; left: number };
    content: React.ReactNode;
}) {
    const approxW = 160;
    const approxH = 56;
    const xInside = cx - pad.left;
    const usableW = chartW - pad.left - pad.right;

    const nearRight = xInside > usableW - approxW - 12;
    const nearBottom = cy > chartH - pad.bottom - approxH - 8;

    let left = cx + (nearRight ? -12 : 12);
    if (nearRight) left = Math.max(pad.left + 8, left - approxW);
    left = clamp(left, pad.left + 8, chartW - pad.right - 8);

    let top = cy - (nearBottom ? approxH + 12 : 12);
    top = clamp(top, pad.top + 8, chartH - pad.bottom - approxH - 8);

    return (
        <div
            className="pointer-events-none absolute max-w-[180px] rounded-md border bg-white px-3 py-2 text-xs shadow-sm"
            style={{ left, top }}
        >
            {content}
        </div>
    );
}

/* ------------------------------- Water bars ------------------------------- */
function WaterBars({ data }: { data: WaterPoint[] }) {
    const days = 7;
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));

    const xs = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach((d) => map.set(d.date, (map.get(d.date) ?? 0) + d.liters));
        const out: WaterPoint[] = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const iso = fmtISO(d);
            out.push({ date: iso, liters: map.get(iso) ?? 0 });
        }
        return out;
    }, [data]);

    const max = Math.max(2, ...xs.map((d) => d.liters));

    // hover for bars
    const wrapRef = useRef<HTMLDivElement>(null);
    const [hover, setHover] = useState<{ i: number; left: number; top: number } | null>(null);

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = wrapRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const colW = rect.width / 7;
        const i = clamp(Math.floor(x / colW), 0, 6);
        setHover({ i, left: i * colW + colW / 2, top: 8 });
    };

    return (
        <div className="relative h-full w-full overflow-hidden rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold">Water consumption</h3>
                <span className="text-xs text-neutral-500">last 7 days</span>
            </div>

            <div
                ref={wrapRef}
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
                className="relative grid h-[150px] grid-cols-7 items-end gap-2 rounded-md bg-white p-3"
            >
                {xs.map((d) => (
                    <div key={d.date} className="flex h-full flex-col items-center justify-end">
                        <div className="w-7 rounded-t bg-blue-400/40" style={{ height: `${(d.liters / max) * 100}%` }} />
                        <div className="mt-1 text-[10px] text-neutral-500">{d.date.slice(5)}</div>
                    </div>
                ))}

                {hover && (
                    <div
                        className="pointer-events-none absolute -translate-x-1/2 rounded-md border bg-white px-2 py-1 text-[11px] shadow-sm"
                        style={{ left: hover.left, top: hover.top }}
                    >
                        <div>{xs[hover.i].liters.toFixed(1)} L</div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* --------------------------------- KPI card ------------------------------- */
function KPI({
    title,
    value,
    subtitle,
    color = 'purple',
    icon,
}: {
    title: string;
    value: string | number;
    subtitle?: string;
    color?: 'purple' | 'blue' | 'orange';
    icon: React.ReactNode;
}) {
    const colorClasses =
        color === 'purple'
            ? 'bg-purple-100 text-purple-900'
            : color === 'blue'
                ? 'bg-blue-100 text-blue-900'
                : 'bg-amber-100 text-amber-900';
    return (
        <div className={`rounded-xl p-5 ${colorClasses}`}>
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/60">
                {icon}
            </div>
            <div className="text-3xl font-semibold leading-none">{value}</div>
            <div className="mt-2 text-sm font-medium">{title}</div>
            {subtitle && <div className="text-xs text-black/60">{subtitle}</div>}
        </div>
    );
}

/* ------------------------------- Water Today ------------------------------ */
function WaterToday({
    goal,
    setGoal,
    entries,
    addWater,
}: {
    goal: number;
    setGoal: (v: number) => void;
    entries: { date: string; liters: number }[];
    addWater: (liters: number) => void;
}) {
    const today = fmtISO(new Date());
    const consumed = entries.filter((e) => e.date === today).reduce((a, b) => a + b.liters, 0);
    const remaining = Math.max(0, goal - consumed);
    const pct = clamp(consumed / Math.max(0.0001, goal), 0, 1);
    const [val, setVal] = useState('');

    return (
        <div className="grid h-full grid-rows-[auto_1fr_auto_auto] gap-3 rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Goal: {goal.toFixed(1)} L</div>
                <button
                    className="rounded-full border px-3 py-1 text-sm"
                    onClick={() => {
                        const s = prompt('Set daily water goal (L):', goal.toString());
                        if (!s) return;
                        const n = parseFloat(s);
                        if (!isFinite(n) || n <= 0) return;
                        setGoal(clamp(n, 0.1, 10));
                    }}
                >
                    Set
                </button>
            </div>

            {/* Middle area — centers the gauge; +20px height */}
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white/70 p-4">
                <div className="text-sm text-blue-900/80">Remaining: {remaining.toFixed(1)} L</div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="relative mx-auto mt-4 flex h-60 w-20 items-end rounded-full bg-blue-50 sm:h-[21rem]">
                        {(() => {
                            const isFull = pct >= 0.999;
                            const radiusClass = isFull ? 'rounded-full' : 'rounded-b-full rounded-t-none';
                            return (
                                <div
                                    className={`absolute left-2 right-2 ${radiusClass} bg-blue-400/30 flex items-center justify-center`}
                                    style={{ height: `calc((100% - 1rem) * ${pct})`, bottom: '0.5rem' }}
                                >
                                    <div className="text-xs font-medium text-neutral-800 text-center">
                                        {consumed.toFixed(1)} L
                                        <div className="text-[10px] opacity-80">today</div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <input
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    placeholder="e.g. 0.6"
                    inputMode="decimal"
                    className="w-full rounded-md border px-3 py-2 outline-none"
                />
                <button
                    className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
                    onClick={() => {
                        const n = parseFloat(val);
                        if (!isFinite(n) || n <= 0) return;
                        addWater(n);
                        setVal('');
                    }}
                >
                    add
                </button>
            </div>

            <div className="text-right text-xs text-neutral-500">today</div>
        </div>
    );
}

/* ----------------------------------- Page --------------------------------- */
export default function Wellness() {
    const [sleep, setSleep] = useLocalArray<SleepPoint>('w_sleep', []);
    const [water, setWater] = useLocalArray<WaterPoint>('w_water', []);
    const [range, setRange] = useState<'1W' | '1M' | '3M' | '1Y'>('1W');

    // ✅ Water goal state + persistence
    const [waterGoal, setWaterGoal] = useState<number>(() => {
        if (typeof window === 'undefined') return 3.2;
        const raw = localStorage.getItem('w_goal');
        return raw ? parseFloat(raw) || 3.2 : 3.2;
    });
    useEffect(() => {
        try {
            localStorage.setItem('w_goal', String(waterGoal));
        } catch { }
    }, [waterGoal]);

    const todayISO = fmtISO(new Date());
    const addSleep = (pt: SleepPoint) =>
        setSleep((cur) => {
            const others = cur.filter((x) => x.date !== pt.date);
            return [...others, pt].sort((a, b) => a.date.localeCompare(b.date));
        });
    const addWater = (liters: number) => setWater((cur) => [...cur, { date: todayISO, liters }]);

    const last7 = useMemo(() => {
        const out: string[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            out.push(fmtISO(d));
        }
        return out;
    }, []);

    const avgSleep7 = useMemo(() => {
        const map = new Map<string, number>();
        sleep.forEach((s) => {
            if (s.hours != null) map.set(s.date, s.hours);
        });
        const vals = last7.map((d) => map.get(d)).filter((v): v is number => v != null && isFinite(v));
        if (vals.length === 0) return 0;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }, [sleep, last7]);

    const avgWater7 = useMemo(() => {
        const map = new Map<string, number>();
        water.forEach((w) => map.set(w.date, (map.get(w.date) ?? 0) + w.liters));
        const vals = last7.map((d) => map.get(d) ?? 0).filter((n) => n > 0);
        if (vals.length === 0) return 0;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }, [water, last7]);

    // ✅ Use current waterGoal in the streak rule
    const streakDays = useMemo(() => {
        const mapWater = new Map<string, number>();
        water.forEach((w) => mapWater.set(w.date, (mapWater.get(w.date) ?? 0) + w.liters));
        const mapSleep = new Map<string, number>();
        sleep.forEach((s) => {
            if (s.hours != null) mapSleep.set(s.date, s.hours);
        });

        let streak = 0;
        for (let i = 0; ; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = fmtISO(d);
            const w = mapWater.get(key) ?? 0;
            const s = mapSleep.get(key);
            const met = s != null && s >= 7 && w >= Math.max(0.1, waterGoal) * 0.5;
            if (met) streak += 1;
            else break;
            if (i > 365) break;
        }
        return streak;
    }, [water, sleep, waterGoal]);

    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <header className="flex w-full items-center justify-between bg-white px-[40px] py-6">
                <h1 className="select-none font-roboto text-3xl text-black tracking-tight">wellness log</h1>
                <nav className="flex gap-2">
                    <Link href="/dashboard" className="px-6 py-2 text-black hover:underline">
                        workouts
                    </Link>
                    <Link href="/dashboard/wellness" className="bg-black px-6 py-2 text-white">
                        wellness
                    </Link>
                    <Link href="/dashboard/nutrition" className="px-6 py-2 text-black hover:underline">
                        nutrition
                    </Link>
                </nav>
            </header>

            {/* Full-height dashboard area fills viewport minus header */}
            <main className="mx-auto grid h-[calc(100vh-128px)] max-w-[1400px] grid-cols-12 gap-6 p-4">
                {/* Left column — Sleep bigger, Water smaller */}
                <section className="col-span-12 grid grid-rows-[2fr_1fr] gap-6 overflow-hidden lg:col-span-7">
                    <SleepLine data={sleep} range={range} onAdd={addSleep} onRange={setRange} />
                    <WaterBars data={water} />
                </section>

                {/* Middle KPIs */}
                <section className="col-span-12 grid grid-rows-3 gap-6 lg:col-span-3">
                    <KPI
                        title="Hours of sleep (avg last 7d)"
                        value={avgSleep7.toFixed(1)}
                        color="purple"
                        icon={<Moon size={18} className="text-purple-700" />}
                    />
                    <KPI
                        title="Liters of water (avg last 7d)"
                        value={avgWater7.toFixed(1)}
                        color="blue"
                        icon={<Droplet size={18} className="text-blue-700" />}
                    />
                    <KPI title="Days in a row goals met" value={streakDays} color="orange" icon={<Flame size={18} className="text-amber-700" />} />
                </section>

                {/* Right column */}
                <section className="col-span-12 lg:col-span-2">
                    {/* ✅ Pass live goal and setter */}
                    <WaterToday goal={waterGoal} setGoal={setWaterGoal} entries={water} addWater={(l) => addWater(l)} />
                </section>
            </main>

            <Navbar />
        </div>
    );
}
