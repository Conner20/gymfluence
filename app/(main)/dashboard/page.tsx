'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import MobileHeader from '@/components/MobileHeader';
import { Trash2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { HEATMAP_COLORS_DARK, HEATMAP_COLORS_LIGHT } from '@/lib/heatmapColors';
import {
    fetchAllDashboardData,
    addExerciseServer,
    addSetServer,
    deleteSetServer,
    saveSplitServer,
    deleteExerciseServer,
    type SetEntry,
} from '@/components/workoutActions';

/** ----------------------------- Helpers ----------------------------- */
function fmtDate(d: Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
function daysBetweenInclusive(a: string, b: string) {
    const da = new Date(a + 'T00:00:00Z');
    const db = new Date(b + 'T00:00:00Z');
    return Math.floor((+db - +da) / 86_400_000) + 1;
}
function addDaysStr(dateStr: string, n: number) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return fmtDate(d);
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
        // fallback for older browsers
        mq.addListener(update);
        return () => mq.removeListener(update);
    }, []);
    return isCoarse;
}

/** ------------------------------ SVG UI ----------------------------- */
function LineChartDual({
    width,
    height,
    weight,
    reps,
    labels,
    dayEntries,
    isDark = false,
}: {
    width: number;
    height: number;
    weight: number[];
    reps: number[];
    labels: string[];
    dayEntries: SetEntry[][];
    isDark?: boolean;
}) {
    const left = 40;
    const right = 40;
    // Shift graph down ~10px
    const top = 28;
    const bottom = 22;
    const w = width - left - right;
    const h = height - top - bottom;

    // --- Dynamic Y scales based on data in the selected time range ---

    // Weight axis
    const nonZeroWeight = weight.filter((v) => v > 0);
    let minW: number;
    let maxW: number;

    if (nonZeroWeight.length === 0) {
        // No data in this range – use a tiny span so chart doesn't collapse
        minW = 0;
        maxW = 1;
    } else {
        // Lowest & highest weight in the current time frame
        minW = Math.min(...nonZeroWeight);
        maxW = Math.max(...nonZeroWeight);

        // If all values are identical, give a small buffer so the line isn't perfectly flat on the axis
        if (minW === maxW) {
            minW = minW - 1;
            maxW = maxW + 1;
        }
    }
    const yW = (v: number) => top + h - ((v - minW) / (maxW - minW || 1)) * h;

    // Reps axis
    const nonZeroReps = reps.filter((v) => v > 0);
    let minR: number;
    let maxR: number;

    if (nonZeroReps.length === 0) {
        minR = 0;
        maxR = 1;
    } else {
        minR = Math.min(...nonZeroReps);
        maxR = Math.max(...nonZeroReps);

        if (minR === maxR) {
            minR = minR - 1;
            maxR = maxR + 1;
        }
    }
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
    const pointerActive = useRef(false);
    const isCoarsePointer = useIsCoarsePointer();

    // --- Tooltip width measurement & centering in CSS pixels ---
    const tipRef = useRef<HTMLDivElement | null>(null);
    const [tipW, setTipW] = useState(140); // fallback width

    // Keep dependency array length/order stable
    useEffect(() => {
        if (tipRef.current) {
            const w = tipRef.current.getBoundingClientRect().width;
            if (Number.isFinite(w) && w > 0) setTipW(w);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hover?.i, hover?.cx, hover?.cyW, hover?.cyR]);

    const updateHoverFromClientX = (clientX: number) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        if (!rect.width) return;
        const scaleX = width / rect.width;
        const mxView = (clientX - rect.left) * scaleX;
        const clamped = Math.max(left, Math.min(left + w, mxView));
        const ratio = (clamped - left) / w;
        const idx = Math.round(ratio * (labels.length - 1));
        const cx = x(idx);
        const wy = weight[idx] > 0 ? yW(weight[idx]) : null;
        const ry = reps[idx] > 0 ? yR(reps[idx]) : null;
        setHover({ i: idx, cx, cyW: wy, cyR: ry });
    };

    const onMove = (e: React.MouseEvent) => {
        updateHoverFromClientX(e.clientX);
    };
    const onLeave = () => {
        pointerActive.current = false;
        setHover(null);
    };

    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === 'mouse') return;
        pointerActive.current = true;
        svgRef.current?.setPointerCapture(e.pointerId);
        e.preventDefault();
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
        if (e.pointerType === 'mouse') return;
        if (pointerActive.current) {
            pointerActive.current = false;
            svgRef.current?.releasePointerCapture(e.pointerId);
        }
    };

    const onPointerCancel = () => {
        pointerActive.current = false;
        setHover(null);
    };

    const hoverDate = hover ? labels[hover.i] : '';
    const hoverRows = hover ? dayEntries[hover.i] : [];
    const hoverAvgW = hoverRows?.length ? average(hoverRows.map((r) => r.weight)) : 0;
    const hoverAvgR = hoverRows?.length ? average(hoverRows.map((r) => r.reps)) : 0;
    const hoverTotalSets = hoverRows?.length ? hoverRows.reduce((s, r) => s + r.sets, 0) : 0;

    // Convert hover.cx (SVG units) into CSS pixels for perfect centering of the tooltip
    let tooltipLeft = 0;
    if (hover) {
        const rect = svgRef.current?.getBoundingClientRect();
        const cssCX = rect ? (hover.cx / width) * rect.width : hover.cx; // CSS pixels
        const min = 4;
        const max = (rect?.width ?? width) - tipW - 4;
        tooltipLeft = Math.max(min, Math.min(max, cssCX - tipW / 2));
    }

    const weightColor = '#16a34a';
    const repsColor = isDark ? '#93c5fd' : '#111827';
    const gridStroke = isDark ? '#1f2937' : '#e5e7eb';
    const tickStroke = isDark ? '#111827' : '#f1f5f9';
    const tickLabel = isDark ? '#d1d5db' : '#6b7280';
    const axisLabel = isDark ? '#e5e7eb' : '#111827';
    const hoverLine = isDark ? '#374151' : '#e5e7eb';
    const dotFill = isDark ? '#0f172a' : '#ffffff';

    return (
        <div className="relative h-full w-full">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="h-full w-full select-none"
                onMouseMove={onMove}
                onMouseLeave={onLeave}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerCancel}
                onPointerCancel={onPointerCancel}
                style={isCoarsePointer ? { touchAction: 'none' } : undefined}
            >
                {/* grid & axes */}
                <line x1={left} y1={top + h} x2={left + w} y2={top + h} stroke={gridStroke} />
                <line x1={left} y1={top} x2={left} y2={top + h} stroke={gridStroke} />
                <line x1={left + w} y1={top} x2={left + w} y2={top + h} stroke={gridStroke} />
                {leftTicks.map((_, i) => {
                    const yy = top + h - (i / ticks) * h;
                    return <line key={i} x1={left} y1={yy} x2={left + w} y2={yy} stroke={tickStroke} />;
                })}

                {/* y ticks */}
                {leftTicks.map((t, i) => (
                    <text key={`lw${i}`} x={left - 6} y={yW(t) + 3} fontSize="10" textAnchor="end" fill={tickLabel}>
                        {Math.round(t)}
                    </text>
                ))}
                {rightTicks.map((t, i) => (
                    <text key={`rr${i}`} x={left + w + 6} y={yR(t) + 3} fontSize="10" textAnchor="start" fill={tickLabel}>
                        {Math.round(t)}
                    </text>
                ))}

                {/* axis titles — moved ~5px UP (from top-6 to top-11) */}
                <text x={left - 30} y={top - 11} fontSize="10" fill={axisLabel}>
                    weight (lbs)
                </text>
                <text x={left + w + 30} y={top - 11} fontSize="10" textAnchor="end" fill={axisLabel}>
                    reps (avg)
                </text>

                {/* x labels: endpoints only */}
                {labels.length > 0 && (
                    <>
                        <text x={x(0)} y={top + h + 14} fontSize="9" textAnchor="start" fill={tickLabel}>
                            {labels[0].slice(5).replace('-', '/')}
                        </text>
                        <text x={x(labels.length - 1)} y={top + h + 14} fontSize="9" textAnchor="end" fill={tickLabel}>
                            {labels[labels.length - 1].slice(5).replace('-', '/')}
                        </text>
                    </>
                )}

                {/* series */}
                {weightPath && <path d={weightPath} fill="none" stroke={weightColor} strokeWidth={2} />}
                {repsPath && <path d={repsPath} fill="none" stroke={repsColor} strokeWidth={2} />}

                {/* points */}
                {weight.map((v, i) => (v > 0 ? <circle key={`pw${i}`} cx={x(i)} cy={yW(v)} r={2.4} fill={weightColor} /> : null))}
                {reps.map((v, i) => (v > 0 ? <circle key={`pr${i}`} cx={x(i)} cy={yR(v)} r={2.4} fill={repsColor} /> : null))}

                {/* hover */}
                {hover && (
                    <>
                        <line x1={hover.cx} y1={top} x2={hover.cx} y2={top + h} stroke={hoverLine} />
                        {hover.cyW != null && <circle cx={hover.cx} cy={hover.cyW} r={3.8} fill={dotFill} stroke={weightColor} strokeWidth={2} />}
                        {hover.cyR != null && <circle cx={hover.cx} cy={hover.cyR} r={3.8} fill={dotFill} stroke={repsColor} strokeWidth={2} />}
                    </>
                )}
                <rect x={left} y={top} width={w} height={h} fill="transparent" />
            </svg>

            {/* legend */}
            <div className="hidden">
                <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-gray-100">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#16a34a' }} />
                    <span className="font-medium">Weight (avg)</span>
                </span>
                <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-gray-100">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#111827' }} />
                    <span className="font-medium">Reps (avg)</span>
                </span>
            </div>

            {/* tooltip (centered over vertical line; clamped to edges) */}
            {hover && (
                <div
                    ref={tipRef}
                    className="pointer-events-none absolute rounded-lg border bg-white px-3 py-2 text-[12px] shadow dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100"
                    style={{
                        left: tooltipLeft,
                        top: 120,
                    }}
                >
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-300">{hoverDate}</div>
                    <div className="mt-1 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#16a34a' }} />
                            <span className="font-medium">{hoverAvgW ? `${hoverAvgW.toFixed(1)} lbs` : '—'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#111827] dark:bg-[#93c5fd]" />
                            <span className="font-medium">
                                {hoverAvgR ? `${hoverAvgR.toFixed(1)} reps` : '—'}
                            </span>
                        </span>

                    </div>
                    <div className="mt-1 text-zinc-700 dark:text-gray-100">
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
    sparseDayLabels = false,
    isDark = false,
}: {
    width: number;
    height: number;
    valuesByDate: Record<string, number>;
    sparseDayLabels?: boolean;
    isDark?: boolean;
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
    // Buckets: <=0, 1–3, 4–6, 7–9, 10+
    const levels = [0, 3, 6, 9, Infinity];
    const colors = isDark ? HEATMAP_COLORS_DARK : HEATMAP_COLORS_LIGHT;
    const labelColor = isDark ? '#d1d5db' : '#6b7280';
    const cellBorder = isDark ? '#4b5563' : 'none';

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
            {data.map((item, idx) => {
                const c = Math.floor(idx / 7);
                const r = idx % 7;
                const x = 8 + c * (cell + gap);
                const y = 8 + labelTop + r * (cell + gap);
                const li = levels.findIndex((t) => item.val <= t);
                const fill = colors[Math.max(0, li)];
                return <rect key={idx} x={x} y={y} width={cell} height={cell} rx="2" ry="2" fill={fill} stroke={cellBorder} strokeWidth={cellBorder === 'none' ? 0 : 0.7} />;
            })}
            {monthTicks.map((t, i) => {
                const x = 8 + t.col * (cell + gap) + cell / 2;
                return (
                    <text key={i} x={x} y={8 + 10} fontSize="10" textAnchor="middle" fill={labelColor}>
                        {t.label}
                    </text>
                );
            })}
            {dayLabels.map((lb, r) => {
                if (sparseDayLabels && r % 2 === 1) return null;
                const y = 8 + labelTop + r * (cell + gap) + cell * 0.7;
                const x = width - 26;
                return (
                    <text key={lb} x={x} y={y} fontSize="10" textAnchor="start" fill={labelColor}>
                        {lb}
                    </text>
                );
            })}
        </svg>
    );
}

/** ------------------------------ Page ------------------------------- */
type RangeKey = '1W' | '1M' | '3M' | '1Y' | 'ALL';

const RANGE_TITLES: Record<RangeKey, string> = {
    '1W': "This week's lifts",
    '1M': "This month's lifts",
    '3M': "Past three months' lifts",
    '1Y': "This year's lifts",
    'ALL': 'My lifts',
};
const SPLIT_ANCHOR_KEY = 'gf_split_anchor_v1';

export default function Dashboard() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [sets, setSets] = useState<SetEntry[]>([]);
    const [exercises, setExercises] = useState<string[]>([]);
    const [exercise, setExercise] = useState<string>('');
    const [split, setSplit] = useState<string[]>([]);
    const [splitAnchor, setSplitAnchor] = useState<{ day: number; index: number } | null>(null);

    // record form
    const [weight, setWeight] = useState('');
    const [setsNum, setSetsNum] = useState('');
    const [reps, setReps] = useState('');
    const [date, setDate] = useState(fmtDate(new Date()));
    const [showRequired, setShowRequired] = useState(false);

    // chart range
    const [range, setRange] = useState<RangeKey>('1W');
    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const heatmapContainerRef = useRef<HTMLDivElement | null>(null);
    const [chartWidth, setChartWidth] = useState(860);
    const [heatmapWidth, setHeatmapWidth] = useState(820);

    const todayDay = daysSinceEpochUTC();
    const repsLineColor = isDark ? '#93c5fd' : '#111827';
    const heatmapPalette = isDark ? HEATMAP_COLORS_DARK : HEATMAP_COLORS_LIGHT;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(SPLIT_ANCHOR_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.day === 'number' && typeof parsed.index === 'number') {
                setSplitAnchor(parsed);
            }
        } catch {
            // ignore malformed storage
        }
    }, []);

    useEffect(() => {
        if (!split.length) return;
        setSplitAnchor((prev) => {
            if (!prev) {
                return {
                    day: todayDay,
                    index: ((todayDay % split.length) + split.length) % split.length,
                };
            }
            const normalizedIndex = ((prev.index % split.length) + split.length) % split.length;
            if (normalizedIndex === prev.index) return prev;
            return { day: prev.day, index: normalizedIndex };
        });
    }, [split.length, todayDay]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!split.length || !splitAnchor) return;
        window.localStorage.setItem(SPLIT_ANCHOR_KEY, JSON.stringify(splitAnchor));
    }, [split.length, splitAnchor]);

    // timer (smooth)
    const [mm, setMm] = useState(0);
    const [ss, setSs] = useState(30);
    const [total, setTotal] = useState(30); // seconds total
    const [msLeft, setMsLeft] = useState(30_000); // ms remaining (smooth)
    const [running, setRunning] = useState(false);
    const [endAt, setEndAt] = useState<number | null>(null); // epoch ms when it ends

    // Load from server (Prisma) on mount
    useEffect(() => {
        (async () => {
            try {
                const data = await fetchAllDashboardData();
                setSets(data.sets);
                setExercises(data.exercises);

                // Default to second exercise if it exists, else first, else ''
                const defaultExercise = data.exercises[0] ?? '';
                setExercise(defaultExercise);

                setSplit(data.split);
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    const daysForRange = (r: Exclude<RangeKey, 'ALL'>) => {
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

    // Labels for the x-axis. For ALL: span from first to last logged date (inclusive).
    const labels = useMemo(() => {
        if (range === 'ALL') {
            if (sets.length === 0) return [];
            // dates are YYYY-MM-DD, so lexicographic sort works
            const sorted = [...sets.map((s) => s.date)].sort();
            const first = sorted[0]!;
            const last = sorted[sorted.length - 1]!;
            const span = daysBetweenInclusive(first, last);
            return Array.from({ length: span }, (_, i) => addDaysStr(first, i));
        } else {
            const n = daysForRange(range);
            return Array.from({ length: n }).map((_, i) => fmtDate(daysAgo(n - 1 - i)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range, sets]);

    const filtered = useMemo(() => sets.filter((s) => s.exercise === exercise), [sets, exercise]);

    useEffect(() => {
        const observers: ResizeObserver[] = [];

        if (chartContainerRef.current) {
            const obs = new ResizeObserver((entries) => {
                const width = entries[0]?.contentRect.width ?? 860;
                setChartWidth(Math.max(320, Math.min(860, width)));
            });
            obs.observe(chartContainerRef.current);
            observers.push(obs);
        }

        if (heatmapContainerRef.current) {
            const obs = new ResizeObserver((entries) => {
                const width = entries[0]?.contentRect.width ?? 820;
                setHeatmapWidth(Math.max(320, Math.min(820, width)));
            });
            obs.observe(heatmapContainerRef.current);
            observers.push(obs);
        }

        return () => observers.forEach((o) => o.disconnect());
    }, []);

    const chartHeight = chartWidth < 600 ? 260 : 370;
    const heatmapHeight = heatmapWidth < 540 ? 140 : 160;

    const perDay = useMemo(() => {
        const g = groupBy(filtered, (r) => r.date);
        return labels.map((d) => g[d] || []);
    }, [filtered, labels]);

    const weightSeries = perDay.map((rows) => (rows.length ? average(rows.map((r) => r.weight)) : 0));
    const repsSeries = perDay.map((rows) => (rows.length ? average(rows.map((r) => r.reps)) : 0));

    // Heatmap: sum of sets per day across ALL exercises
    const heatmapValues = useMemo(() => {
        const g = groupBy(sets, (r) => r.date);
        const out: Record<string, number> = {};
        Object.entries(g).forEach(([d, rows]) => {
            out[d] = rows.reduce((acc, r) => acc + r.sets, 0);
        });
        return out;
    }, [sets]);

    const splitLen = split.length;
    const normalizeSplitIndex = (idx: number) => {
        if (!splitLen) return 0;
        return ((idx % splitLen) + splitLen) % splitLen;
    };
    const defaultAnchor = splitLen
        ? { day: todayDay, index: normalizeSplitIndex(todayDay) }
        : { day: todayDay, index: 0 };
    const activeAnchor = splitLen ? splitAnchor ?? defaultAnchor : defaultAnchor;
    const deltaDays = splitLen ? todayDay - activeAnchor.day : 0;
    const effectiveSplitIndex = splitLen ? normalizeSplitIndex(activeAnchor.index + deltaDays) : 0;
    const splitToday = splitLen ? split[effectiveSplitIndex] : '—';
    const splitProgress = splitLen ? (effectiveSplitIndex + 1) / splitLen : 0;
    const moveSplitDay = (delta: number) => {
        if (!splitLen) return;
        const nextIndex = normalizeSplitIndex(effectiveSplitIndex + delta);
        setSplitAnchor({ day: todayDay, index: nextIndex });
    };

    const addExercise = async () => {
        const name = prompt('New exercise name');
        if (!name) return;
        try {
            const created = await addExerciseServer(name);
            // Update local list (keep sorted)
            setExercises((x) => Array.from(new Set([...x, created.name])).sort());
            setExercise(created.name);
        } catch (e) {
            console.error(e);
        }
    };

    // Remove currently selected exercise (persisted via server)
    const removeExercise = async () => {
        if (!exercise) return;

        const ok = confirm(
            `Remove exercise "${exercise}"? This will also delete all sets logged for this exercise.`
        );
        if (!ok) return;

        try {
            const res = await deleteExerciseServer(exercise);
            if (!res?.deleted) return;

            // Update exercise list + selection
            setExercises((prev) => {
                const next = prev.filter((ex) => ex !== exercise);
                const defaultExercise = next[1] ?? next[0] ?? '';
                setExercise(defaultExercise);
                return next;
            });

            // Remove its sets from local state so the UI matches DB
            setSets((prev) => prev.filter((s) => s.exercise !== exercise));
        } catch (e) {
            console.error(e);
        }
    };

    const customizeSplit = async () => {
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

        try {
            await saveSplitServer(parts);
            setSplit(parts);
            setSplitAnchor({ day: todayDay, index: 0 });
        } catch (e) {
            console.error(e);
        }
    };

    // ---- Validation + Save ----
    const recordSet = async () => {
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

        try {
            const created = await addSetServer({
                exerciseName: exercise,
                weight: w,
                sets: s,
                reps: r,
                date,
            });
            setSets((prev) => [created, ...prev]);
            setWeight('');
            setSetsNum('');
            setReps('');
            setShowRequired(false);
        } catch (e) {
            console.error(e);
        }
    };

    // delete entry
    const deleteSet = async (id: string) => {
        try {
            const res = await deleteSetServer(id);
            if (res.deleted) setSets((prev) => prev.filter((x) => x.id !== id));
        } catch (e) {
            console.error(e);
        }
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
        `w-full border rounded px-2 py-1 text-sm mt-1 dark:border-white/20 dark:bg-transparent dark:text-gray-100 ${
            showRequired && empty ? 'text-red-600 placeholder-red-400' : ''
        }`;

    const mobileTabs = (
        <div className="px-4 pb-4">
            <div className="flex gap-2 text-sm">
                <Link
                    href="/dashboard"
                    className="flex-1 rounded-2xl border border-zinc-900 bg-zinc-900 px-4 py-2 text-center font-medium text-white dark:border-white dark:bg-white/10"
                >
                    workouts
                </Link>
                <Link
                    href="/dashboard/wellness"
                    className="flex-1 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-2 text-center font-medium text-zinc-600 transition hover:border-zinc-400 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/30"
                >
                    wellness
                </Link>
                <Link
                    href="/dashboard/nutrition"
                    className="flex-1 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-2 text-center font-medium text-zinc-600 transition hover:border-zinc-400 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/30"
                >
                    nutrition
                </Link>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen flex-col bg-[#f8f8f8] text-black dark:bg-[#050505] dark:text-white lg:h-screen lg:overflow-hidden">
            <MobileHeader title="workouts log" href="/dashboard" subContent={mobileTabs} />

            {/* Header (fixed height) */}
            <header className="hidden lg:flex w-full flex-none items-center justify-between bg-white px-[40px] py-5 dark:bg-neutral-900 dark:border-b dark:border-white/10">
                <h1 className="select-none font-roboto text-3xl tracking-tight text-green-700 dark:text-green-400">workouts log</h1>
                <nav className="flex gap-2 text-sm">
                    <Link href="/dashboard" className="rounded-full bg-black border border-zinc-200 px-6 py-2 font-medium text-white transition dark:bg-white/10 dark:border-white-b/60 dark:text-gray-200">
                        workouts
                    </Link>
                    {/* {flex - 1 rounded-2xl border border-zinc-900 bg-zinc-900 px-4 py-2 text-center font-medium text-white dark:border-white dark:bg-white/10} */}
                    <Link
                        href="/dashboard/wellness"
                        className="rounded-full border border-zinc-200 px-6 py-2 font-medium text-zinc-600 transition hover:border-zinc-400 dark:bg-white/5 dark:border-white/20 dark:text-gray-200 dark:hover:border-white/40"
                    >
                        wellness
                    </Link>
                    <Link
                        href="/dashboard/nutrition"
                        className="rounded-full border border-zinc-200 px-6 py-2 font-medium text-zinc-600 transition hover:border-zinc-400 dark:bg-white/5 dark:border-white/20 dark:text-gray-200 dark:hover:border-white/40"
                    >
                        nutrition
                    </Link>
                </nav>
            </header>

            {/* Content (fills remaining viewport, no body scroll) */}
            <div className="w-full flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-3 scrollbar-slim lg:h-full lg:px-4 lg:pb-4 lg:pt-3 lg:overflow-y-auto">
                <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 lg:grid lg:min-h-[940px] lg:h-full lg:min-w-0 lg:grid-cols-12">
                    {/* Left Column */}
                    <div className="contents lg:col-span-3 lg:min-h-0 lg:flex lg:flex-col lg:gap-3 lg:h-full">
                        {/* Record Set */}
                        <section className="order-1 flex flex-col rounded-xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none lg:order-none lg:min-h-0 lg:flex-[55]">
                                <div className="mb-2">
                                    <h3 className="font-semibold">Record set</h3>
                                </div>

                                {/* Fill the card's height and center the form BLOCK vertically (equal top/bottom space) */}
                                <div className="flex-1">
                                    <div className="mx-auto flex h-full max-w-[420px] flex-col justify-center gap-6 lg:-translate-y-3">
                                        <div>
                                            <label className="text-[11px] text-zinc-500 dark:text-zinc-300">exercise</label>
                                            <div className="mt-1 flex gap-2">
                                                <select
                                                    value={exercise}
                                                    onChange={(e) => setExercise(e.target.value)}
                                                    className="w-full rounded border px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                                >
                                                    {exercises.map((ex) => (
                                                        <option key={ex} value={ex}>
                                                            {ex}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button onClick={addExercise} className="rounded border px-2 py-1 text-xs dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10">
                                                    Add
                                                </button>
                                                <button onClick={removeExercise} className="rounded border px-2 py-1 text-xs dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10">
                                                    Remove
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[11px] text-zinc-500 dark:text-zinc-300">weight (lbs)</label>
                                                <input
                                                    value={weight}
                                                    onChange={(e) => setWeight(e.target.value)}
                                                    placeholder="required"
                                                    className={reqClass(weight.trim() === '')}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[11px] text-zinc-500 dark:text-zinc-300">sets</label>
                                                    <input
                                                        value={setsNum}
                                                        onChange={(e) => setSetsNum(e.target.value)}
                                                        placeholder="required"
                                                        className={reqClass(setsNum.trim() === '')}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] text-zinc-500 dark:text-zinc-300">reps</label>
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
                                            <label className="text-[11px] text-zinc-500 dark:text-zinc-300 block lg:inline-block">date</label>
                                            <input
                                                type="date"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className="mt-1 w-full max-w-[322px] rounded border px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent dark:text-gray-100 lg:max-w-none"
                                            />
                                        </div>

                                        <div>
                                            <button
                                                onClick={recordSet}
                                                className="w-full rounded-lg bg-green-600 py-2 text-white transition hover:bg-green-700"
                                            >
                                                Save set
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                        {/* Timer */}
                        <section className="order-4 flex flex-col items-stretch rounded-xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none lg:order-none lg:min-h-0 lg:flex-[38]">
                                <h3 className="mb-2 font-semibold">Timer</h3>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        value={mm}
                                        onChange={(e) => setMm(Math.max(0, Number(e.target.value)))}
                                        className="w-14 rounded border px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                    />
                                    <span className="text-xs text-zinc-500 dark:text-zinc-300">min</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={ss}
                                        onChange={(e) => setSs(Math.min(59, Math.max(0, Number(e.target.value))))}
                                        className="w-14 rounded border px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                    />
                                    <span className="text-xs text-zinc-500 dark:text-zinc-300">sec</span>
                                    <button onClick={applyTimer} className="ml-auto rounded border px-2 py-1 text-xs dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10">
                                        Set
                                    </button>
                                </div>

                                <div className="mt-2 flex min-h-0 flex-1 items-center justify-center">
                                    <TimerRing msLeft={msLeft} total={total} />
                                </div>

                                <div className="mt-2 flex justify-center gap-2">
                                    {!running ? (
                                        <button onClick={startTimer} className="rounded bg-black px-3 py-1.5 text-white dark:bg-white dark:text-black">
                                            start
                                        </button>
                                    ) : (
                                        <button onClick={pauseTimer} className="rounded border px-3 py-1.5 dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10">
                                            pause
                                        </button>
                                    )}
                                    <button onClick={resetTimer} className="rounded border px-3 py-1.5 dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10">
                                        reset
                                    </button>
                                </div>
                        </section>
                    </div>

                    {/* Center Column */}
                    <div className="contents lg:col-span-6 lg:min-h-0 lg:flex lg:flex-col lg:gap-3 lg:h-full">
                        {/* Lifts (title depends on selected range) */}
                        <section className="order-2 relative min-h-0 rounded-xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none lg:order-none lg:flex lg:flex-col lg:flex-[60] lg:min-h-0">
                            {/* Header */}
                            <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-gray-300 lg:block">
                                    <h3 className="font-semibold text-base text-black dark:text-white">{RANGE_TITLES[range]}</h3>
                                    <div className="lg:hidden text-[11px] text-zinc-600 dark:text-gray-300">{exercise || '—'}</div>
                                    <div className="hidden lg:block">{exercise || '—'}</div>
                                </div>
                            </div>

                            <div className="mb-1 flex items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-300 lg:hidden">
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#16a34a' }} />
                                    <span>Weight</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: repsLineColor }} />
                                    <span>Reps</span>
                                </span>
                            </div>
                            <div className="hidden items-center gap-4 text-[11px] text-zinc-600 dark:text-gray-300 lg:flex">
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#16a34a' }} />
                                    <span>Weight</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: repsLineColor }} />
                                    <span>Reps</span>
                                </span>
                            </div>

                            {/* Chart area */}
                            <div className="flex flex-col gap-2 lg:gap-3 lg:flex-1 lg:min-h-0">
                                <div className="h-[320px] lg:flex-1 lg:min-h-0" ref={chartContainerRef}>
                                    <LineChartDual
                                        width={chartWidth}
                                        height={chartHeight}
                                        labels={labels}
                                        weight={weightSeries.map((x) => Number(x.toFixed(1)))}
                                        reps={repsSeries.map((x) => Number(x.toFixed(1)))}
                                        dayEntries={perDay}
                                        isDark={isDark}
                                    />
                                </div>

                                <div className="hidden items-center justify-center gap-2 lg:flex">
                                    {(['1W', '1M', '3M', '1Y', 'ALL'] as const).map((r) => (
                                        <button
                                            key={r}
                                            className={`h-8 rounded-full px-3 text-sm ${
                                                r === range
                                                    ? 'bg-black text-white dark:bg-white dark:text-black'
                                                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-gray-200 dark:hover:bg-white/10'
                                            }`}
                                            onClick={() => onRange(r)}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Range buttons — mobile */}
                            <div className="mt-2 flex items-center justify-center gap-2 lg:hidden">
                                {(['1W', '1M', '3M', '1Y', 'ALL'] as const).map((r) => (
                                    <button
                                        key={r}
                                        className={`h-8 rounded-full px-3 text-sm ${
                                            r === range
                                                ? 'bg-black text-white dark:bg-white dark:text-black'
                                                : 'text-neutral-700 hover:bg-neutral-100 dark:text-gray-200 dark:hover:bg-white/10'
                                        }`}
                                        onClick={() => onRange(r)}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* 2025 volume (slightly taller than default earlier) */}
                        <section className="order-5 min-h-0 rounded-xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none lg:order-none lg:h-[calc(36%+15px)]">
                            <div className="mb-1 flex items-center justify-between">
                                <h3 className="font-semibold">{new Date().getFullYear()} volume</h3>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-300">total sets per day</div>
                            </div>
                            <div className="flex h-[220px] items-center justify-center lg:h-[calc(100%-52px)]" ref={heatmapContainerRef}>
                                <YearHeatmap
                                    width={heatmapWidth}
                                    height={heatmapHeight}
                                    valuesByDate={heatmapValues}
                                    sparseDayLabels={heatmapWidth < 640}
                                    isDark={isDark}
                                />
                            </div>
                            <div className="mt-1 flex items-center gap-5 text-[11px] text-zinc-600 dark:text-gray-300">
                                <LegendItem label="≤0" color={heatmapPalette[0]} borderColor={isDark ? '#4b5563' : undefined} />
                                <LegendItem label="1–3" color={heatmapPalette[1]} />
                                <LegendItem label="4–6" color={heatmapPalette[2]} />
                                <LegendItem label="7–9" color={heatmapPalette[3]} />
                                <LegendItem label="10+" color={heatmapPalette[4]} />
                            </div>
                        </section>
                    </div>

                    {/* Right Column */}
                    <div className="contents lg:col-span-3 lg:min-h-0 lg:flex lg:flex-col lg:gap-3 lg:h-full">
                        {/* Recent entries */}
                        <section className="order-3 min-h-0 rounded-xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none lg:order-none lg:flex-[55]">
                                <h3 className="mb-2 font-semibold">Recent entries</h3>
                                <div className="max-h-80 overflow-auto pr-1 scrollbar-slim lg:h-[calc(100%-28px)] lg:max-h-none">
                                    {sets.length === 0 ? (
                                        <div className="text-sm text-zinc-500 dark:text-zinc-300">No sets yet.</div>
                                    ) : (
                                        <ul className="space-y-1.5 text-sm">
                                            {sets.slice(0, 100).map((r) => (
                                                <li key={r.id} className="flex items-center justify-between rounded-lg border px-2 py-1 dark:border-white/20 dark:bg-white/5">
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium">{r.exercise}</div>
                                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-300">{r.date}</div>
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
                                                            className="p-1 text-zinc-500 dark:text-zinc-300 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-500"
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

                        {/* Split with arrows */}
                        <section className="order-6 flex min-h-0 flex-col rounded-xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:shadow-none lg:order-none lg:flex-[38]">
                                <div className="mb-1 flex items-center justify-between">
                                    <h3 className="font-semibold">Split</h3>
                                    <button onClick={customizeSplit} className="rounded border px-2 py-1 text-xs dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10">
                                        Customize
                                    </button>
                                </div>

                                <div className="mt-2 flex flex-1 items-center justify-center">
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            className="rounded-full border px-2 py-1 text-sm dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10"
                                            title="Previous day"
                                            onClick={() => moveSplitDay(-1)}
                                        >
                                            ←
                                        </button>

                                        <SplitRing items={split} activeIndex={effectiveSplitIndex} progress={splitProgress} />

                                        <button
                                            className="rounded-full border px-2 py-1 text-sm dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10"
                                            title="Next day"
                                            onClick={() => moveSplitDay(1)}
                                        >
                                            →
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[12px]">
                                    {split.length ? (
                                        split.map((name, idx) => (
                                            <div
                                                key={idx}
                                                className={`rounded border px-2 py-1 dark:border-white/20 ${
                                                    idx === effectiveSplitIndex
                                                        ? 'border-green-600 bg-green-600 text-white dark:border-green-400 dark:bg-green-500/20 dark:text-white'
                                                        : 'bg-white dark:bg-white/5 dark:text-gray-100'
                                                }`}
                                                title={idx === effectiveSplitIndex ? 'selected' : undefined}
                                            >
                                                {name}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-4 text-zinc-500 dark:text-zinc-300">No split set</div>
                                    )}
                                </div>

                                {!split.length && (
                                    <div className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-300">
                                        Customize your split
                                    </div>
                                )}
                        </section>
                    </div>
                </div>
            </div>

        </div>
    );
}

/** ------------------------ Small UI helpers ------------------------- */
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
            <svg viewBox="0 0 128 128" className="h-24 w-24 sm:h-28 sm:w-28 lg:h-24 lg:w-24">
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
