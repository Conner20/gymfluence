'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Trash2 } from 'lucide-react';

/** ------------------------------ Types ------------------------------ */
type SetEntry = {
    id: string;
    exercise: string;
    weight: number;
    sets: number;
    reps: number;
    date: string; // YYYY-MM-DD
};

/** --------------------------- LocalStorage -------------------------- */
const LS_SETS = 'gf_sets';
const LS_EXS = 'gf_exercises';
const LS_SPLIT = 'gf_workout_split';

function loadSets(): SetEntry[] {
    try {
        const raw = localStorage.getItem(LS_SETS);
        return raw ? (JSON.parse(raw) as SetEntry[]) : [];
    } catch {
        return [];
    }
}
function saveSets(rows: SetEntry[]) {
    localStorage.setItem(LS_SETS, JSON.stringify(rows));
}
function loadExercises(): string[] {
    try {
        const raw = localStorage.getItem(LS_EXS);
        const arr = raw
            ? (JSON.parse(raw) as string[])
            : ['incline dumbbell press', 'squat', 'deadlift', 'bench press', 'overhead press'];
        if (!raw) localStorage.setItem(LS_EXS, JSON.stringify(arr));
        return arr;
    } catch {
        return ['incline dumbbell press', 'squat', 'deadlift', 'bench press', 'overhead press'];
    }
}
function saveExercises(arr: string[]) {
    localStorage.setItem(LS_EXS, JSON.stringify(arr));
}
function loadSplit(): string[] {
    try {
        const raw = localStorage.getItem(LS_SPLIT);
        if (raw) {
            const arr = (JSON.parse(raw) as string[]).map((s) => s.toLowerCase());
            return arr.length ? arr : ['rest', 'legs', 'push', 'pull'];
        }
    } catch { }
    return ['rest', 'legs', 'push', 'pull'];
}
function saveSplit(arr: string[]) {
    localStorage.setItem(LS_SPLIT, JSON.stringify(arr));
}

/** ----------------------------- Helpers ----------------------------- */
function fmtDate(d: Date) {
    return d.toISOString().slice(0, 10);
}
function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}
function groupBy<T, K extends string | number>(xs: T[], key: (x: T) => K) {
    return xs.reduce((acc, x) => {
        const k = key(x);
        (acc[k] ||= []).push(x);
        return acc;
    }, {} as Record<K, T[]>);
}
function average(nums: number[]) {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function daysSinceEpochUTC(date = new Date()) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** ------------------------------ SVG UI ----------------------------- */
function LineChartDual({
    width,
    height,
    weight,
    reps,
    labels,
    dayEntries,
}: {
    width: number;
    height: number;
    weight: number[];
    reps: number[];
    labels: string[];
    dayEntries: SetEntry[][];
}) {
    const left = 40;
    const right = 40;
    const top = 28;     // +10px to push the chart down
    const bottom = 22;
    const w = width - left - right;
    const h = height - top - bottom;

    const minW = Math.min(...weight.filter((v) => v > 0), 0);
    const maxW = Math.max(...weight, Math.max(1, minW + 1));
    const yW = (v: number) => top + h - ((v - minW) / (maxW - minW || 1)) * h;

    const minR = Math.min(...reps.filter((v) => v > 0), 0);
    const maxR = Math.max(...reps, Math.max(1, minR + 1));
    const yR = (v: number) => top + h - ((v - minR) / (maxR - minR || 1)) * h;

    const x = (i: number) => left + (i / Math.max(1, labels.length - 1)) * w;

    const ticks = 4;
    const leftTicks = Array.from({ length: ticks + 1 }, (_, i) => minW + ((maxW - minW) * i) / ticks);
    const rightTicks = Array.from({ length: ticks + 1 }, (_, i) => minR + ((maxR - minR) * i) / ticks);

    const mkPath = (arr: number[], yScale: (v: number) => number) => {
        let started = false;
        let d = '';
        arr.forEach((v, i) => {
            if (!(Number.isFinite(v) && v > 0)) return;
            const cmd = started ? 'L' : 'M';
            started = true;
            d += `${cmd} ${x(i)} ${yScale(v)} `;
        });
        return d.trim();
    };

    const weightPath = mkPath(weight, yW);
    const repsPath = mkPath(reps, yR);

    const [hover, setHover] = useState<{ i: number; cx: number; cyW: number | null; cyR: number | null } | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

    const onMove = (e: React.MouseEvent) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const scaleX = width / rect.width;
        const mxView = (e.clientX - rect.left) * scaleX;

        const clamped = Math.max(left, Math.min(left + w, mxView));
        const ratio = (clamped - left) / w;
        const idx = Math.round(ratio * (labels.length - 1));
        const cx = x(idx);
        const wy = weight[idx] > 0 ? yW(weight[idx]) : null;
        const ry = reps[idx] > 0 ? yR(reps[idx]) : null;
        setHover({ i: idx, cx, cyW: wy, cyR: ry });
    };
    const onLeave = () => setHover(null);

    const hoverDate = hover ? labels[hover.i] : '';
    const hoverRows = hover ? dayEntries[hover.i] : [];
    const hoverAvgW = hoverRows?.length ? average(hoverRows.map((r) => r.weight)) : 0;
    const hoverAvgR = hoverRows?.length ? average(hoverRows.map((r) => r.reps)) : 0;
    const hoverTotalSets = hoverRows?.length ? hoverRows.reduce((s, r) => s + r.sets, 0) : 0;

    return (
        <div className="relative w-full h-full">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-full select-none"
                onMouseMove={onMove}
                onMouseLeave={onLeave}
            >
                {/* grid & axes */}
                <line x1={left} y1={top + h} x2={left + w} y2={top + h} stroke="#e5e7eb" />
                <line x1={left} y1={top} x2={left} y2={top + h} stroke="#e5e7eb" />
                <line x1={left + w} y1={top} x2={left + w} y2={top + h} stroke="#e5e7eb" />
                {leftTicks.map((_, i) => {
                    const yy = top + h - (i / ticks) * h;
                    return <line key={i} x1={left} y1={yy} x2={left + w} y2={yy} stroke="#f1f5f9" />;
                })}

                {/* y ticks */}
                {leftTicks.map((t, i) => (
                    <text key={`lw${i}`} x={left - 6} y={yW(t) + 3} fontSize="10" textAnchor="end" fill="#6b7280">
                        {Math.round(t)}
                    </text>
                ))}
                {rightTicks.map((t, i) => (
                    <text key={`rr${i}`} x={left + w + 6} y={yR(t) + 3} fontSize="10" textAnchor="start" fill="#6b7280">
                        {Math.round(t)}
                    </text>
                ))}

                {/* axis titles (nudged ~5px closer to chart) */}
                <text x={left - 30} y={top - 1} fontSize="10" fill="#111827">
                    weight (lbs)
                </text>
                <text x={left + w + 30} y={top - 1} fontSize="10" textAnchor="end" fill="#111827">
                    reps (avg)
                </text>

                {/* x labels: endpoints only */}
                {labels.length > 0 && (
                    <>
                        <text x={x(0)} y={top + h + 14} fontSize="9" textAnchor="start" fill="#6b7280">
                            {labels[0].slice(5).replace('-', '/')}
                        </text>
                        <text
                            x={x(labels.length - 1)}
                            y={top + h + 14}
                            fontSize="9"
                            textAnchor="end"
                            fill="#6b7280"
                        >
                            {labels[labels.length - 1].slice(5).replace('-', '/')}
                        </text>
                    </>
                )}

                {/* series */}
                {weightPath && <path d={weightPath} fill="none" stroke="#16a34a" strokeWidth={2} />}
                {repsPath && <path d={repsPath} fill="none" stroke="#111827" strokeWidth={2} />}

                {/* points */}
                {weight.map((v, i) => (v > 0 ? <circle key={`pw${i}`} cx={x(i)} cy={yW(v)} r={2.4} fill="#16a34a" /> : null))}
                {reps.map((v, i) => (v > 0 ? <circle key={`pr${i}`} cx={x(i)} cy={yR(v)} r={2.4} fill="#111827" /> : null))}

                {/* hover */}
                {hover && (
                    <>
                        <line x1={hover.cx} y1={top} x2={hover.cx} y2={top + h} stroke="#e5e7eb" />
                        {hover.cyW != null && <circle cx={hover.cx} cy={hover.cyW} r={3.8} fill="white" stroke="#16a34a" strokeWidth={2} />}
                        {hover.cyR != null && <circle cx={hover.cx} cy={hover.cyR} r={3.8} fill="white" stroke="#111827" strokeWidth={2} />}
                    </>
                )}
                <rect x={left} y={top} width={w} height={h} fill="transparent" />
            </svg>

            {/* legend */}
            <div className="absolute left-2 top-2 flex items-center gap-4 text-[12px]">
                <span className="inline-flex items-center gap-1 text-zinc-700">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#16a34a' }} />
                    <span className="font-medium">Weight (avg)</span>
                </span>
                <span className="inline-flex items-center gap-1 text-zinc-700">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#111827' }} />
                    <span className="font-medium">Reps (avg)</span>
                </span>
            </div>

            {/* tooltip */}
            {hover && (
                <div
                    className="pointer-events-none absolute rounded-lg border bg-white px-3 py-2 text-[12px] shadow"
                    style={{
                        left: Math.min(Math.max(hover.cx - 70, 4), width - 140),
                        top: 8,
                    }}
                >
                    <div className="text-[11px] text-zinc-500">{hoverDate}</div>
                    <div className="mt-1 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#16a34a' }} />
                            <span className="font-medium">{hoverAvgW ? `${hoverAvgW.toFixed(1)} lbs` : '—'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#111827' }} />
                            <span className="font-medium">{hoverAvgR ? `${hoverAvgR.toFixed(1)} reps` : '—'}</span>
                        </span>
                    </div>
                    <div className="mt-1 text-zinc-700">
                        sets: <span className="font-medium">{hoverTotalSets}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function YearHeatmap({
    width,
    height,
    valuesByDate,
}: {
    width: number;
    height: number;
    valuesByDate: Record<string, number>;
}) {
    const cols = 53;
    const rows = 7;
    const pad = 8;
    const labelTop = 14;
    const labelRight = 26;
    const gap = 1.8;
    const innerW = width - pad * 2 - labelRight;
    const innerH = height - pad * 2 - labelTop;
    const cell = Math.min(innerW / cols - gap, innerH / rows - gap);

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    const backToMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - backToMonday);

    const data: { d: Date; key: string; val: number }[] = [];
    for (let i = 0; i < cols * rows; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = fmtDate(d);
        data.push({ d, key, val: valuesByDate[key] || 0 });
    }

    const monthTicks: { label: string; col: number }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < data.length; i++) {
        const { d } = data[i];
        if (d.getDate() === 1) {
            const col = Math.floor(i / 7);
            if (!monthTicks.some((t) => t.col === col)) {
                monthTicks.push({ label: monthNames[d.getMonth()], col });
            }
        }
    }

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const levels = [0, 1, 3, 6, 10];
    const colors = ['#e5e7eb', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399'];

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
            {data.map((item, idx) => {
                const c = Math.floor(idx / 7);
                const r = idx % 7;
                const x = 8 + c * (cell + gap);
                const y = 8 + labelTop + r * (cell + gap);
                const level = levels.findIndex((t) => item.val <= t);
                const fill = colors[Math.max(0, level)];
                return <rect key={idx} x={x} y={y} width={cell} height={cell} rx="2" ry="2" fill={fill} />;
            })}
            {monthTicks.map((t, i) => {
                const x = 8 + t.col * (cell + gap) + cell / 2;
                return (
                    <text key={i} x={x} y={8 + 10} fontSize="10" textAnchor="middle" fill="#6b7280">
                        {t.label}
                    </text>
                );
            })}
            {dayLabels.map((lb, r) => {
                const y = 8 + labelTop + r * (cell + gap) + cell * 0.7;
                const x = width - 26; // previously shifted left to avoid clipping
                return (
                    <text key={lb} x={x} y={y} fontSize="10" textAnchor="start" fill="#6b7280">
                        {lb}
                    </text>
                );
            })}
        </svg>
    );
}

/** ------------------------------ Page ------------------------------- */
type RangeKey = '1W' | '1M' | '3M' | '1Y';

export default function Dashboard() {
    const [sets, setSets] = useState<SetEntry[]>([]);
    const [exercises, setExercises] = useState<string[]>([]);
    const [exercise, setExercise] = useState<string>('');
    const [split, setSplit] = useState<string[]>([]);

    // record form
    const [weight, setWeight] = useState('');
    const [setsNum, setSetsNum] = useState('');
    const [reps, setReps] = useState('');
    const [date, setDate] = useState(fmtDate(new Date()));
    const [showRequired, setShowRequired] = useState(false);

    // chart range
    const [range, setRange] = useState<RangeKey>('1W');

    // timer (smooth)
    const [mm, setMm] = useState(0);
    const [ss, setSs] = useState(30);
    const [total, setTotal] = useState(30);            // seconds total
    const [msLeft, setMsLeft] = useState(30_000);      // ms remaining (smooth)
    const [running, setRunning] = useState(false);
    const [endAt, setEndAt] = useState<number | null>(null); // epoch ms when it ends

    // split manual offset for arrows
    const [splitOffset, setSplitOffset] = useState(0);

    useEffect(() => {
        const s = loadSets();
        setSets(s);
        const exs = loadExercises();
        setExercises(exs);
        setExercise(exs[0] || '');
        setSplit(loadSplit());
    }, []);
    useEffect(() => saveSets(sets), [sets]);
    useEffect(() => saveExercises(exercises), [exercises]);
    useEffect(() => saveSplit(split), [split]);

    const daysForRange = (r: RangeKey) => {
        switch (r) {
            case '1W':
                return 7;
            case '1M':
                return 30;
            case '3M':
                return 90;
            case '1Y':
                return 365;
        }
    };
    const labels = useMemo(() => {
        const n = daysForRange(range);
        return Array.from({ length: n }).map((_, i) => fmtDate(daysAgo(n - 1 - i)));
    }, [range]);

    const filtered = useMemo(() => sets.filter((s) => s.exercise === exercise), [sets, exercise]);

    const perDay = useMemo(() => {
        const g = groupBy(filtered, (r) => r.date);
        return labels.map((d) => g[d] || []);
    }, [filtered, labels]);

    const weightSeries = perDay.map((rows) => (rows.length ? average(rows.map((r) => r.weight)) : 0));
    const repsSeries = perDay.map((rows) => (rows.length ? average(rows.map((r) => r.reps)) : 0));

    const heatmapValues = useMemo(() => {
        const g = groupBy(sets, (r) => r.date);
        const out: Record<string, number> = {};
        Object.entries(g).forEach(([d, rows]) => {
            out[d] = rows.reduce((acc, r) => acc + r.sets, 0);
        });
        return out;
    }, [sets]);

    // base index from "today"
    const baseIndex = useMemo(() => {
        const cycleLen = Math.max(1, split.length || 1);
        return daysSinceEpochUTC() % cycleLen;
    }, [split]);

    // apply manual offset (wrap when split has items)
    const activeIndex = useMemo(() => {
        if (!split.length) return 0;
        const L = split.length;
        return ((baseIndex + ((splitOffset % L) + L) % L) + L) % L;
    }, [baseIndex, split, splitOffset]);

    const splitToday = split.length ? split[activeIndex] : '—';
    const splitProgress = useMemo(() => (split.length ? (activeIndex + 1) / split.length : 0), [split, activeIndex]);

    const addExercise = () => {
        const name = prompt('New exercise name');
        if (!name) return;
        if (exercises.includes(name)) return setExercise(name);
        setExercises((x) => [...x, name]);
        setExercise(name);
    };

    const customizeSplit = () => {
        const current = split.join(', ');
        const input = prompt(
            'Customize split (comma-separated). Example: push, pull, legs or push, pull, legs, rest',
            current || 'push, pull, legs, rest'
        );
        if (!input) return;

        const parts = input
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

        if (!parts.length) return;
        setSplit(parts);
        setSplitOffset(0);
    };

    const recordSet = () => {
        if (!exercise) return alert('Pick an exercise first.');

        const missing = {
            w: weight.trim() === '',
            s: setsNum.trim() === '',
            r: reps.trim() === '',
        };
        if (missing.w || missing.s || missing.r) {
            setShowRequired(true);
            return;
        }

        const w = Number(weight),
            s = Number(setsNum),
            r = Number(reps);
        if (!Number.isFinite(w) || !Number.isFinite(s) || !Number.isFinite(r)) {
            alert('Enter numeric weight/sets/reps.');
            return;
        }

        const entry: SetEntry = { id: crypto.randomUUID(), exercise, weight: w, sets: s, reps: r, date };
        setSets((prev) => [entry, ...prev]);
        setWeight('');
        setSetsNum('');
        setReps('');
        setShowRequired(false);
    };

    const deleteSet = (id: string) => {
        setSets((prev) => prev.filter((x) => x.id !== id));
    };

    // ----- Timer controls (smooth) -----
    const applyTimer = () => {
        const t = Math.max(0, mm * 60 + ss);
        setTotal(t);
        setMsLeft(t * 1000);
        setRunning(false);
        setEndAt(null);
    };

    const startTimer = () => {
        if (total <= 0) return;
        const base = Math.max(0, msLeft);
        setEndAt(Date.now() + base);
        setRunning(true);
    };

    const pauseTimer = () => {
        setRunning(false);
        if (endAt) setMsLeft(Math.max(0, endAt - Date.now()));
        setEndAt(null);
    };

    const resetTimer = () => {
        setRunning(false);
        const t = Math.max(0, mm * 60 + ss);
        setTotal(t);
        setMsLeft(t * 1000);
        setEndAt(null);
    };

    useEffect(() => {
        if (!running || !endAt) return;
        let raf = 0;

        const tick = () => {
            const left = Math.max(0, endAt - Date.now());
            setMsLeft(left);
            if (left <= 0) {
                setRunning(false);
                setEndAt(null);
                return;
            }
            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [running, endAt]);

    const onRange = (r: RangeKey) => setRange(r);

    const reqClass = (empty: boolean) =>
        `w-full border rounded px-2 py-1 text-sm mt-1 ${showRequired && empty ? 'text-red-600 placeholder-red-400' : ''}`;

    const prevSplitDay = () => {
        if (!split.length) return;
        setSplitOffset((o) => o - 1);
    };
    const nextSplitDay = () => {
        if (!split.length) return;
        setSplitOffset((o) => o + 1);
    };

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-[#f8f8f8]">
            {/* Header (fixed height) */}
            <header className="flex w-full flex-none items-center justify-between bg-white px-[40px] py-5">
                <h1 className="select-none font-roboto text-3xl tracking-tight text-black">workouts log</h1>
                <nav className="flex gap-2">
                    <Link href="/dashboard" className="bg-black px-6 py-2 text-white">
                        workouts
                    </Link>
                    <Link href="/dashboard/wellness" className="px-6 py-2 text-black hover:underline">
                        wellness
                    </Link>
                    <Link href="/dashboard/nutrition" className="px-6 py-2 text-black hover:underline">
                        nutrition
                    </Link>
                </nav>
            </header>

            {/* Content (fills remaining viewport, no body scroll) */}
            <div className="mx-auto h-full max-w-[1400px] flex-1 overflow-hidden px-3 pb-2 pt-3">
                <div className="grid h-full grid-cols-12 gap-3">
                    {/* Left Column */}
                    <div className="col-span-3 min-h-0">
                        <div className="flex h-full min-h-0 flex-col gap-3">
                            {/* Record Set */}
                            <section className="flex min-h-0 flex-[55] flex-col rounded-xl border bg-white p-3 shadow-sm">
                                <div className="mb-2 flex items-center justify-between">
                                    <h3 className="font-semibold">Record set</h3>
                                    <button onClick={recordSet} className="rounded bg-black px-2 py-1 text-xs text-white">
                                        +
                                    </button>
                                </div>

                                <div className="space-y-2 overflow-auto pr-0.5">
                                    <div>
                                        <label className="text-[11px] text-zinc-500">exercise</label>
                                        <div className="mt-1 flex gap-2">
                                            <select
                                                value={exercise}
                                                onChange={(e) => setExercise(e.target.value)}
                                                className="flex-1 rounded border px-2 py-1 text-sm"
                                            >
                                                {exercises.map((ex) => (
                                                    <option key={ex} value={ex}>
                                                        {ex}
                                                    </option>
                                                ))}
                                            </select>
                                            <button onClick={addExercise} className="rounded border px-2 py-1 text-xs">
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[11px] text-zinc-500">weight (lbs)</label>
                                            <input
                                                value={weight}
                                                onChange={(e) => setWeight(e.target.value)}
                                                placeholder="required"
                                                className={reqClass(weight.trim() === '')}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[11px] text-zinc-500">sets</label>
                                                <input
                                                    value={setsNum}
                                                    onChange={(e) => setSetsNum(e.target.value)}
                                                    placeholder="required"
                                                    className={reqClass(setsNum.trim() === '')}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] text-zinc-500">reps</label>
                                                <input
                                                    value={reps}
                                                    onChange={(e) => setReps(e.target.value)}
                                                    placeholder="required"
                                                    className={reqClass(reps.trim() === '')}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[11px] text-zinc-500">date</label>
                                        <input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="mt-1 w-full rounded border px-2 py-1 text-sm"
                                        />
                                    </div>

                                    <button
                                        onClick={recordSet}
                                        className="w-full rounded-lg bg-green-600 py-2 text-white transition hover:bg-green-700"
                                    >
                                        Save set
                                    </button>
                                </div>
                            </section>

                            {/* Timer */}
                            <section className="flex min-h-0 flex-[38] flex-col items-stretch rounded-xl border bg-white p-3 shadow-sm">
                                <h3 className="mb-2 font-semibold">Timer</h3>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        value={mm}
                                        onChange={(e) => setMm(Math.max(0, Number(e.target.value)))}
                                        className="w-14 rounded border px-2 py-1 text-sm"
                                    />
                                    <span className="text-xs text-zinc-500">min</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={ss}
                                        onChange={(e) => setSs(Math.min(59, Math.max(0, Number(e.target.value))))}
                                        className="w-14 rounded border px-2 py-1 text-sm"
                                    />
                                    <span className="text-xs text-zinc-500">sec</span>
                                    <button onClick={applyTimer} className="ml-auto rounded border px-2 py-1 text-xs">
                                        Set
                                    </button>
                                </div>

                                <div className="mt-2 flex min-h-0 flex-1 items-center justify-center">
                                    <TimerRing msLeft={msLeft} total={total} />
                                </div>

                                <div className="mt-2 flex justify-center gap-2">
                                    {!running ? (
                                        <button onClick={startTimer} className="rounded bg-black px-3 py-1.5 text-white">
                                            start
                                        </button>
                                    ) : (
                                        <button onClick={pauseTimer} className="rounded border px-3 py-1.5">
                                            pause
                                        </button>
                                    )}
                                    <button onClick={resetTimer} className="rounded border px-3 py-1.5">
                                        reset
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Center Column */}
                    <div className="col-span-6 min-h-0 flex flex-col gap-3">
                        {/* Today’s lifts — TALLER, with centered buttons at BOTTOM */}
                        <section className="min-h-0 rounded-xl border bg-white p-3 shadow-sm" style={{ height: '60%' }}>
                            {/* Header (title left, exercise name right) */}
                            <div className="mb-1 flex items-center justify-between">
                                <h3 className="font-semibold">Today’s lifts</h3>
                                <div className="max-w-[40ch] truncate text-xs text-zinc-600">{exercise || '—'}</div>
                            </div>

                            {/* Chart area (leave room for buttons below) */}
                            <div className="h-[calc(100%-86px)]">
                                <LineChartDual
                                    width={860}
                                    height={310}
                                    labels={labels}
                                    weight={weightSeries.map((x) => Number(x.toFixed(1)))}
                                    reps={repsSeries.map((x) => Number(x.toFixed(1)))}
                                    dayEntries={perDay}
                                />
                            </div>

                            {/* Centered range buttons at bottom */}
                            <div className="mt-3 flex justify-center">
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
                                </div>
                            </div>
                        </section>

                        {/* 2025 volume — SLIGHTLY TALLER (+15px) */}
                        <section
                            className="min-h-0 rounded-xl border bg-white p-3 shadow-sm"
                            style={{ height: 'calc(36% + 15px)' }}
                        >
                            <div className="mb-1 flex items-center justify-between">
                                <h3 className="font-semibold">2025 volume</h3>
                                <div className="text-[11px] text-zinc-500">total sets per day</div>
                            </div>
                            <div className="h-[calc(100%-52px)]">
                                <YearHeatmap width={820} height={160} valuesByDate={heatmapValues} />
                            </div>
                            <div className="mt-1 flex items-center gap-5 text-[11px] text-zinc-600">
                                <LegendItem label="≤0 sets" color="#e5e7eb" />
                                <LegendItem label="1–3 sets" color="#d1fae5" />
                                <LegendItem label="4–6 sets" color="#a7f3d0" />
                                <LegendItem label="7–10 sets" color="#6ee7b7" />
                                <LegendItem label="10+ sets" color="#34d399" />
                            </div>
                        </section>
                    </div>

                    {/* Right Column */}
                    <div className="col-span-3 min-h-0">
                        <div className="flex h-full min-h-0 flex-col gap-3">
                            {/* Recent entries */}
                            <section className="min-h-0 flex-[55] rounded-xl border bg-white p-3 shadow-sm">
                                <h3 className="mb-2 font-semibold">Recent entries</h3>
                                <div className="h-[calc(100%-28px)] overflow-auto pr-1">
                                    {sets.length === 0 ? (
                                        <div className="text-sm text-zinc-500">No sets yet.</div>
                                    ) : (
                                        <ul className="space-y-1.5 text-sm">
                                            {sets.slice(0, 100).map((r) => (
                                                <li
                                                    key={r.id}
                                                    className="flex items-center justify-between rounded-lg border px-2 py-1"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium">{r.exercise}</div>
                                                        <div className="text-[11px] text-zinc-500">{r.date}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right text-[11px]">
                                                            <div>{r.weight} lbs</div>
                                                            <div>
                                                                {r.sets} x {r.reps}
                                                            </div>
                                                        </div>
                                                        <button
                                                            aria-label="Delete"
                                                            className="p-1 text-zinc-500 hover:text-red-600"
                                                            onClick={() => deleteSet(r.id)}
                                                            title="Delete entry"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </section>

                            {/* Split */}
                            <section className="min-h-0 flex-[38] rounded-xl border bg-white p-3 shadow-sm">
                                <div className="flex items-center justify-between">
                                    {/* Title + arrows */}
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">Split</h3>
                                        <div className="flex items-center gap-1">
                                            <button
                                                className="rounded border px-2 py-0.5 text-sm"
                                                onClick={prevSplitDay}
                                                aria-label="Previous split day"
                                                title="Previous day"
                                            >
                                                ←
                                            </button>
                                            <button
                                                className="rounded border px-2 py-0.5 text-sm"
                                                onClick={nextSplitDay}
                                                aria-label="Next split day"
                                                title="Next day"
                                            >
                                                →
                                            </button>
                                        </div>
                                    </div>
                                    <button onClick={customizeSplit} className="rounded border px-2 py-1 text-xs">
                                        Customize
                                    </button>
                                </div>

                                <div className="mt-2 flex items-center justify-center">
                                    <SplitRing items={split} activeIndex={activeIndex} progress={splitProgress} />
                                </div>

                                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[12px]">
                                    {split.length ? (
                                        split.map((name, idx) => (
                                            <div
                                                key={idx}
                                                className={`rounded border px-2 py-1 ${idx === activeIndex ? 'border-green-600 bg-green-600 text-white' : 'bg-white'
                                                    }`}
                                                title={idx === activeIndex ? 'today' : undefined}
                                            >
                                                {name}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-4 text-zinc-500">No split set</div>
                                    )}
                                </div>

                                <div className="mt-2 text-center text-sm">
                                    {split.length ? (
                                        <>
                                            <span className="text-zinc-600">Today:</span>{' '}
                                            <span className="font-semibold text-green-700">{splitToday}</span>
                                        </>
                                    ) : (
                                        <span className="text-zinc-500">Customize your split</span>
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>

            <Navbar />
        </div>
    );
}

/** ------------------------ Small UI helpers ------------------------- */
function LegendItem({ label, color }: { label: string; color: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded" style={{ background: color }} />
            <span>{label}</span>
        </div>
    );
}

function SplitRing({
    items,
    activeIndex,
    progress,
}: {
    items: string[];
    activeIndex: number;
    progress: number;
}) {
    const radius = 52;
    const cx = 60;
    const cy = 60;
    const full = 2 * Math.PI * radius;

    const segments = items.length || 1;
    const segLen = full / segments;

    return (
        <svg viewBox="0 0 120 120" className="h-28 w-28 sm:h-32 sm:w-32">
            {/* faint outline */}
            <circle cx={cx} cy={cy} r={radius} stroke="#e5e7eb" strokeWidth="10" fill="none" />
            {/* progress around ring */}
            <circle
                cx={cx}
                cy={cy}
                r={radius}
                stroke="#16a34a"
                strokeWidth="10"
                fill="none"
                strokeDasharray={`${(progress * full).toFixed(2)} ${(full - progress * full).toFixed(2)}`}
                transform="rotate(-90 60 60)"
                strokeLinecap="round"
            />
            {items.length > 0 && (
                <g transform="rotate(-90 60 60)">
                    <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        stroke="#111827"
                        strokeWidth="10"
                        fill="none"
                        strokeDasharray={`${segLen} ${full}`}
                        strokeDashoffset={full - activeIndex * segLen}
                    />
                </g>
            )}
        </svg>
    );
}

/** --------------------------- Timer Ring ---------------------------- */
function TimerRing({ msLeft, total }: { msLeft: number; total: number }) {
    const r = 54;
    const cx = 64;
    const cy = 64;
    const c = 2 * Math.PI * r;
    const frac = total > 0 ? Math.max(0, Math.min(1, msLeft / (total * 1000))) : 0;

    const secondsLeft = Math.floor(msLeft / 1000);
    const mm = Math.floor(secondsLeft / 60);
    const ss = secondsLeft % 60;

    return (
        <div className="relative">
            <svg viewBox="0 0 128 128" className="h-24 w-24 sm:h-28 sm:w-28">
                {/* subtle outline so the white remainder is visible */}
                <circle cx={cx} cy={cy} r={r} stroke="#e5e7eb" strokeWidth="10" fill="none" />
                {/* white remainder background */}
                <circle cx={cx} cy={cy} r={r} stroke="#ffffff" strokeWidth="10" fill="none" />
                {/* yellow arc for time left (smooth) */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    stroke="#facc15"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${(c * frac).toFixed(2)} ${(c * (1 - frac)).toFixed(2)}`}
                    transform="rotate(-90 64 64)"
                    strokeLinecap="butt"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="tabular-nums text-lg font-semibold sm:text-xl">
                    {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
                </div>
            </div>
        </div>
    );
}
