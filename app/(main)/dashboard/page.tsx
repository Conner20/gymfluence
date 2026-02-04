'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MobileHeader from '@/components/MobileHeader';
import { Trash2, CalendarDays, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import {
    fetchAllDashboardData,
    addExerciseServer,
    addSetServer,
    deleteSetServer,
    deleteExerciseServer,
    addCardioSessionServer,
    deleteCardioSessionServer,
    type SetEntry,
    type CardioSessionEntry,
    type CardioMode,
    type DistanceUnit,
} from '@/components/workoutActions';
import { HEATMAP_COLORS_DARK, HEATMAP_COLORS_LIGHT } from '@/lib/heatmapColors';

type RangeKey = '1W' | '1M' | '3M' | '1Y' | 'ALL';

const CARDIO_RANGE_DAYS: Record<RangeKey, number> = {
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '1Y': 365,
    'ALL': 120,
};

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

function buildCardioSeries(
    sessions: CardioSessionEntry[],
    mode: CardioMode,
    range: RangeKey,
    displayUnit: DistanceUnit,
) {
    let labels: string[];

    if (range === 'ALL' && sessions.length) {
        const sortedDates = [...sessions.map((s) => s.date)].sort();
        const first = sortedDates[0]!;
        const todayStr = fmtDate(new Date());
        const end = todayStr;
        const span = daysBetweenInclusive(first, end);
        labels = Array.from({ length: span }, (_, idx) => addDaysStr(first, idx));
    } else {
        const total = Math.max(1, CARDIO_RANGE_DAYS[range] ?? 7);
        labels = Array.from({ length: total }, (_, idx) => fmtDate(daysAgo(total - 1 - idx)));
    }

    const toMiles = (value: number, unit: DistanceUnit) => (unit === 'km' ? value * 0.621371 : value);
    const milesToUnit = (value: number, unit: DistanceUnit) => (unit === 'km' ? value * 1.60934 : value);

    const aggregated = labels.map((label) => {
        const daySessions = sessions.filter((session) => session.activity === mode && session.date === label);
        const distanceMiles = daySessions.reduce((sum, entry) => {
            if (typeof entry.distance !== 'number') return sum;
            return sum + toMiles(entry.distance, entry.distanceUnit ?? 'mi');
        }, 0);
        const timeMinutes = daySessions.reduce((sum, entry) => sum + entry.timeMinutes, 0);
        const calories = daySessions.reduce((sum, entry) => sum + (entry.calories ?? 0), 0);
        const sessionIds = daySessions.map((entry) => entry.id);
        return { label, distanceMiles, timeMinutes, calories, sessionIds };
    });

    return {
        labels,
        distance: aggregated.map((day) => Number(milesToUnit(day.distanceMiles, displayUnit).toFixed(2))),
        time: aggregated.map((day) => day.timeMinutes),
        calories: aggregated.map((day) => day.calories),
        sessionIdsPerPoint: aggregated.map((day) => day.sessionIds),
    };
}

/** ------------------------------ SVG UI ----------------------------- */
type LiftsChartProps = {
    width: number;
    height: number;
    labels: string[];
    weight: number[];
    reps: number[];
    dayEntries: SetEntry[][];
    isDark: boolean;
    onDeleteSet: (setId: string) => void;
};

function LiftsChart({ width, height, labels, weight, reps, dayEntries, isDark, onDeleteSet }: LiftsChartProps) {
    const left = 48;
    const right = 48;
    const top = 32;
    const bottom = 28;
    const w = width - left - right;
    const h = height - top - bottom;

    if (!labels.length) {
        return (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-200 text-sm text-zinc-500 dark:border-white/10 dark:text-white/70">
                Log sets to view trends.
            </div>
        );
    }

    const series = [
        { key: 'weight', label: 'Weight', color: '#16a34a', suffix: ' lbs', values: weight },
        { key: 'reps', label: 'Reps', color: isDark ? '#93c5fd' : '#111827', suffix: ' reps', values: reps },
    ] as const;

    const maxValue = Math.max(
        1,
        ...weight.map((value) => (Number.isFinite(value) ? value : 0)),
        ...reps.map((value) => (Number.isFinite(value) ? value : 0)),
    );

    const xPositions = labels.map((_, idx) =>
        labels.length > 1 ? left + (idx / (labels.length - 1)) * w : left + w / 2,
    );
    const yScale = (value: number) => top + h - (Math.max(0, value) / maxValue) * h;

    const formatLabel = (label?: string) => {
        if (!label) return '';
        return label.includes('-') ? label.slice(5).replace('-', '/') : label;
    };
    const mkPath = (values: number[]) => {
        let started = false;
        let d = '';
        values.forEach((val, idx) => {
            if (!Number.isFinite(val) || val <= 0) return;
            const cmd = started ? 'L' : 'M';
            started = true;
            d += `${cmd} ${xPositions[idx] ?? left} ${yScale(val)} `;
        });
        return d.trim();
    };

    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const axisColor = isDark ? '#d4d4d8' : '#475569';

    const svgRef = useRef<SVGSVGElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const [hover, setHover] = useState<{ index: number; svgX: number; svgY: number } | null>(null);

    const updateHover = (clientX: number) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const relX = clientX - rect.left;
        let closestIdx = 0;
        let closestDelta = Number.POSITIVE_INFINITY;
        xPositions.forEach((x, idx) => {
            const delta = Math.abs(x - relX);
            if (delta < closestDelta) {
                closestDelta = delta;
                closestIdx = idx;
            }
        });
        const anchorValues = series.map((line) => line.values[closestIdx] ?? 0);
        const anchorY = Math.min(...anchorValues.map((val) => yScale(val || 0)));
        setHover({ index: closestIdx, svgX: xPositions[closestIdx] ?? left, svgY: anchorY });
    };

    const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
        updateHover(event.clientX);
    };
    const handleTouchMove = (event: React.TouchEvent<SVGSVGElement>) => {
        if (event.touches[0]) {
            updateHover(event.touches[0].clientX);
        }
    };
    const handleSvgLeave = (event: React.PointerEvent<SVGSVGElement>) => {
        if (event.pointerType === 'touch') return;
        const next = event.relatedTarget;
        if (
            next instanceof Node &&
            tooltipRef.current &&
            tooltipRef.current.contains(next)
        ) {
            return;
        }
        setHover(null);
    };
    const handleTooltipLeave = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'touch') return;
        const next = event.relatedTarget;
        if (next instanceof Node && svgRef.current && svgRef.current.contains(next)) {
            return;
        }
        setHover(null);
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleGlobalPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (
                (svgRef.current && svgRef.current.contains(target)) ||
                (tooltipRef.current && tooltipRef.current.contains(target))
            ) {
                return;
            }
            setHover(null);
        };
        window.addEventListener('pointerdown', handleGlobalPointerDown);
        return () => window.removeEventListener('pointerdown', handleGlobalPointerDown);
    }, []);

    const gridSteps = 4;
    const horizontalLines = Array.from({ length: gridSteps + 1 }, (_, i) => top + (i / gridSteps) * h);

    const tooltipWidth = 200;
    const tooltipHeight = 140;
    const tooltipStyles = hover
        ? {
              left: Math.min(Math.max(hover.svgX - tooltipWidth / 2, 12), width - tooltipWidth - 12),
              top: Math.max(hover.svgY - tooltipHeight - 12, 8),
          }
        : null;

    const hoveredValues =
        hover &&
        series.map((line) => ({
            key: line.key,
            label: line.label,
            color: line.color,
            value: line.values[hover.index],
            suffix: line.suffix,
        }));
    const hoveredEntries = hover ? dayEntries[hover.index] ?? [] : [];
    const totalSets = hoveredEntries.reduce((sum, entry) => sum + entry.sets, 0);
    const deleteSetId =
        hoveredEntries.length
            ? hoveredEntries[hoveredEntries.length - 1]?.id ?? hoveredEntries[0]?.id
            : undefined;

    return (
        <div className="relative h-full w-full">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="h-full w-full"
                onPointerMove={handlePointerMove}
                onPointerLeave={handleSvgLeave}
                onTouchStart={handleTouchMove}
                onTouchMove={handleTouchMove}
            >
                <rect x={0} y={0} width={width} height={height} fill="transparent" />
                {horizontalLines.map((y, idx) => (
                    <line
                        key={`grid-${idx}`}
                        x1={left}
                        x2={width - right}
                        y1={y}
                        y2={y}
                        stroke={gridColor}
                        strokeDasharray="3 6"
                    />
                ))}
                {labels.length > 0 && (
                    <g>
                        <text
                            x={xPositions[0]}
                            y={height - 6}
                            fontSize="10"
                            textAnchor="start"
                            fill={axisColor}
                        >
                            {formatLabel(labels[0])}
                        </text>
                        {labels.length > 1 && (
                            <text
                                x={xPositions[labels.length - 1]}
                                y={height - 6}
                                fontSize="10"
                                textAnchor="end"
                                fill={axisColor}
                            >
                                {formatLabel(labels[labels.length - 1])}
                            </text>
                        )}
                    </g>
                )}
                <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke={axisColor} strokeWidth={0.5} />
                <line x1={left} x2={left} y1={top} y2={height - bottom} stroke={axisColor} strokeWidth={0.5} />

                {series.map((line) => (
                    <path
                        key={line.key}
                        d={mkPath(line.values)}
                        fill="none"
                        stroke={line.color}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        opacity={0.95}
                    />
                ))}

                {series.map((line) =>
                    line.values.map((val, idx) =>
                        val > 0 ? (
                            <circle
                                key={`${line.key}-point-${idx}`}
                                cx={xPositions[idx]}
                                cy={yScale(val)}
                                r={3}
                                fill={line.color}
                                opacity={0.8}
                            />
                        ) : null,
                    ),
                )}

                {hover && (
                    <line
                        x1={hover.svgX}
                        x2={hover.svgX}
                        y1={top}
                        y2={height - bottom}
                        stroke={isDark ? '#ffffff40' : '#11182730'}
                        strokeDasharray="4 6"
                    />
                )}

                {hover &&
                    series.map((line) => {
                        const value = line.values[hover.index];
                        if (!value || !Number.isFinite(value)) return null;
                        return (
                            <circle
                                key={`${line.key}-dot`}
                                cx={hover.svgX}
                                cy={yScale(value)}
                                r={5}
                                fill={line.color}
                                stroke={isDark ? '#030712' : '#ffffff'}
                                strokeWidth={2}
                            />
                        );
                    })}
            </svg>

            {hover && tooltipStyles && hoveredValues && (
                <div
                    ref={tooltipRef}
                    className="absolute min-w-[190px] rounded-2xl border border-zinc-200 bg-white/95 p-3 text-xs shadow-lg dark:border-white/10 dark:bg-zinc-900/95"
                    style={{ left: tooltipStyles.left, top: tooltipStyles.top }}
                    onPointerLeave={handleTooltipLeave}
                >
                    <div className="mb-2 flex items-center justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            {labels[hover.index]}
                        </div>
                        {deleteSetId && (
                            <button
                                type="button"
                                className="rounded-full border border-transparent p-1 text-red-500 hover:border-red-200 hover:bg-red-50 dark:text-red-400 dark:hover:border-red-400/40 dark:hover:bg-red-500/10"
                                onClick={() => onDeleteSet(deleteSetId)}
                                aria-label="Delete set"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        {hoveredValues.map(({ key, label, color, value, suffix }) => (
                            <div key={key} className="flex items-center justify-between text-[13px] font-semibold text-zinc-800 dark:text-white">
                                <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                                    {label}
                                </span>
                                <span>{value ? `${value}${suffix}` : '—'}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-white/5 dark:text-zinc-300">
                        <div className="flex items-center justify-between text-[12px] font-semibold text-zinc-800 dark:text-white">
                            <span>Sets logged</span>
                            <span>{totalSets || '—'}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                            {hoveredEntries.length ? `${hoveredEntries.length} entries` : 'No entries'}
                        </div>
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
export default function Dashboard() {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [sets, setSets] = useState<SetEntry[]>([]);
    const [exercises, setExercises] = useState<string[]>([]);
    const [exercise, setExercise] = useState<string>('');
    const [cardioForm, setCardioForm] = useState<CardioFormState>({
        activity: 'running',
        time: '',
        distance: '',
        calories: '',
        date: fmtDate(new Date()),
    });
    const [cardioSessions, setCardioSessions] = useState<CardioSessionEntry[]>([]);
    const [cardioMode, setCardioMode] = useState<CardioMode>('running');
    const [cardioRange, setCardioRange] = useState<RangeKey>('1W');
    const [cardioDistanceUnit, setCardioDistanceUnit] = useState<DistanceUnit>('mi');

    // record form
    const [weight, setWeight] = useState('');
    const [setsNum, setSetsNum] = useState('');
    const [reps, setReps] = useState('');
    const [date, setDate] = useState(fmtDate(new Date()));
    const [showRequired, setShowRequired] = useState(false);

    // chart range
    const [range, setRange] = useState<RangeKey>('1W');
    const liftChartContainerRef = useRef<HTMLDivElement | null>(null);
    const cardioChartContainerRef = useRef<HTMLDivElement | null>(null);
    const [liftChartWidth, setLiftChartWidth] = useState(860);
    const [cardioChartWidth, setCardioChartWidth] = useState(860);

    const todayDay = daysSinceEpochUTC();
    const repsLineColor = isDark ? '#93c5fd' : '#111827';

    // timer (smooth)
    // Load from server (Prisma) on mount
    useEffect(() => {
        (async () => {
            try {
                const data = await fetchAllDashboardData();
                if (data.requiresAuth) {
                    router.push('/');
                    return;
                }
                setSets(data.sets);
                setExercises(data.exercises);
                const defaultExercise = data.exercises[0] ?? '';
                setExercise(defaultExercise);
                setCardioSessions(data.cardioSessions ?? []);
            } catch (e) {
                console.error(e);
            }
        })();
    }, [router]);

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

    const filtered = useMemo(() => sets.filter((s) => s.exercise === exercise), [sets, exercise]);

    // Labels for the x-axis. For ALL: span from first logged date through today (so same-day entries appear immediately).
    const labels = useMemo(() => {
        if (range === 'ALL') {
            if (filtered.length === 0) return [];
            // dates are YYYY-MM-DD, so lexicographic sort works
            const sorted = [...filtered.map((s) => s.date)].sort();
            const first = sorted[0]!;
            const todayStr = fmtDate(new Date());
            const end = todayStr;
            const span = daysBetweenInclusive(first, end);
            return Array.from({ length: span }, (_, i) => addDaysStr(first, i));
        }

        const n = daysForRange(range);
        return Array.from({ length: n }).map((_, i) => fmtDate(daysAgo(n - 1 - i)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range, filtered]);
    const cardioChartData = useMemo(
        () => buildCardioSeries(cardioSessions, cardioMode, cardioRange, cardioDistanceUnit),
        [cardioSessions, cardioMode, cardioRange, cardioDistanceUnit],
    );

    useEffect(() => {
        const observers: ResizeObserver[] = [];

        if (liftChartContainerRef.current) {
            const obs = new ResizeObserver((entries) => {
                const width = entries[0]?.contentRect.width ?? 860;
                setLiftChartWidth(Math.max(320, Math.min(860, width)));
            });
            obs.observe(liftChartContainerRef.current);
            observers.push(obs);
        }

        if (cardioChartContainerRef.current) {
            const obs = new ResizeObserver((entries) => {
                const width = entries[0]?.contentRect.width ?? 860;
                setCardioChartWidth(Math.max(320, Math.min(860, width)));
            });
            obs.observe(cardioChartContainerRef.current);
            observers.push(obs);
        }

        return () => observers.forEach((o) => o.disconnect());
    }, []);

    const liftChartHeight = liftChartWidth < 600 ? 260 : 370;
    const cardioChartHeight = cardioChartWidth < 600 ? 260 : 370;

    const perDay = useMemo(() => {
        const g = groupBy(filtered, (r) => r.date);
        return labels.map((d) => g[d] || []);
    }, [filtered, labels]);

    const weightSeries = perDay.map((rows) => (rows.length ? average(rows.map((r) => r.weight)) : 0));
    const repsSeries = perDay.map((rows) => (rows.length ? average(rows.map((r) => r.reps)) : 0));


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

    const handleCardioSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const timeMinutes = Number(cardioForm.time);
        if (!Number.isFinite(timeMinutes) || timeMinutes <= 0) {
            return;
        }
        const distanceValue = cardioForm.distance.trim() !== '' ? Number(cardioForm.distance) : undefined;
        const caloriesValue = cardioForm.calories.trim() !== '' ? Number(cardioForm.calories) : undefined;

        try {
            const created = await addCardioSessionServer({
                activity: cardioForm.activity as CardioMode,
                timeMinutes,
                distance: distanceValue,
                distanceUnit: cardioDistanceUnit,
                calories: caloriesValue,
                date: cardioForm.date,
            });
            setCardioSessions((prev) => [created, ...prev]);
            setCardioForm((prev) => ({ ...prev, time: '', distance: '', calories: '' }));
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteCardioPoint = async (sessionId: string) => {
        try {
            const res = await deleteCardioSessionServer(sessionId);
            if (res?.deleted) {
                setCardioSessions((prev) => prev.filter((entry) => entry.id !== sessionId));
            }
        } catch (error) {
            console.error(error);
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

    const onRange = (r: RangeKey) => setRange(r);

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
                <div className="mx-auto w-full max-w-[1400px] space-y-4">

                    <div className="grid gap-4 lg:grid-cols-12">
                        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900 lg:col-span-5">
                            <header className="mb-4">
                                <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Log strength</p>
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Record set</h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Capture weight, sets, and reps for any lift.</p>
                            </header>
                            <StrengthForm
                                exercises={exercises}
                                exercise={exercise}
                                weight={weight}
                                setsNum={setsNum}
                                reps={reps}
                                date={date}
                                setExercise={setExercise}
                                setWeight={setWeight}
                                setSetsNum={setSetsNum}
                                setReps={setReps}
                                setDate={setDate}
                                addExercise={addExercise}
                                removeExercise={removeExercise}
                                recordSet={recordSet}
                            />
                        </section>

                        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900 lg:col-span-7">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Strength</p>
                                    <h3 className="text-lg font-semibold text-black dark:text-white">Lift trends</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{exercise || 'Select an exercise'}</p>
                                </div>
                                <div className="flex flex-wrap gap-1 rounded-full border border-zinc-200/70 bg-white/70 p-1 text-[10px] font-semibold uppercase tracking-wide dark:border-white/15 dark:bg-white/5">
                                    {( ['1W','1M','3M','1Y','ALL'] as const).map((r) => (
                                        <button
                                            key={r}
                                            className={`rounded-full px-2.5 py-1 transition ${
                                                r === range
                                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                                    : 'text-zinc-500 hover:bg-zinc-100 dark:text-gray-200 dark:hover:bg-white/10'
                                            }`}
                                            onClick={() => onRange(r)}
                                            aria-pressed={r === range}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-4 flex items-center gap-4 text-[11px] text-zinc-600 dark:text-gray-300">
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
                                    <span>Weight</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: repsLineColor }} />
                                    <span>Reps</span>
                                </span>
                            </div>
                            <div ref={liftChartContainerRef} className="h-[320px] lg:h-[360px]">
                                <LiftsChart
                                    width={liftChartWidth}
                                    height={liftChartHeight}
                                    labels={labels}
                                    weight={weightSeries.map((x) => Number(x.toFixed(1)))}
                                    reps={repsSeries.map((x) => Number(x.toFixed(1)))}
                                    dayEntries={perDay}
                                    isDark={isDark}
                                    onDeleteSet={deleteSet}
                                />
                            </div>
                        </section>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-12">
                        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900 lg:col-span-5">
                            <header className="mb-4">
                                <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Cardio</p>
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Session log</h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Distance, time, and calories at a glance.</p>
                            </header>
                            <CardioForm
                                form={cardioForm}
                                setForm={setCardioForm}
                                onSubmit={handleCardioSubmit}
                                distanceUnit={cardioDistanceUnit}
                                setDistanceUnit={setCardioDistanceUnit}
                            />
                        </section>

                        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900 lg:col-span-7">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Cardio trends</p>
                                    <h3 className="text-lg font-semibold capitalize text-black dark:text-white">{cardioMode} sessions</h3>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
                                    <div className="flex flex-wrap gap-2">
                                        {( ['running','biking','walking','swimming'] as CardioMode[]).map((mode) => (
                                            <button
                                                key={mode}
                                                className={`rounded-full px-3 py-1.5 capitalize transition ${
                                                    cardioMode === mode
                                                        ? 'bg-black text-white dark:bg-white dark:text-black'
                                                        : 'text-neutral-700 hover:bg-neutral-100 dark:text-gray-200 dark:hover:bg-white/10'
                                                }`}
                                                onClick={() => setCardioMode(mode)}
                                                aria-pressed={cardioMode === mode}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-1 rounded-full border border-zinc-200/70 bg-white/70 p-1 text-[10px] font-semibold uppercase tracking-wide dark:border-white/15 dark:bg-white/5">
                                        {( ['1W','1M','3M','1Y','ALL'] as RangeKey[]).map((rangeKey) => (
                                            <button
                                                key={rangeKey}
                                                className={`rounded-full px-2.5 py-1 transition ${
                                                    cardioRange === rangeKey
                                                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                                        : 'text-zinc-500 hover:bg-zinc-100 dark:text-gray-200 dark:hover:bg-white/10'
                                                }`}
                                                onClick={() => setCardioRange(rangeKey)}
                                                aria-pressed={cardioRange === rangeKey}
                                            >
                                                {rangeKey}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div ref={cardioChartContainerRef} className="h-[320px] lg:h-[360px]">
                                <CardioChart
                                    width={cardioChartWidth}
                                    height={cardioChartHeight}
                                    data={cardioChartData}
                                    isDark={isDark}
                                    onDelete={handleDeleteCardioPoint}
                                    distanceUnit={cardioDistanceUnit}
                                    sessionIdsPerPoint={cardioChartData.sessionIdsPerPoint}
                                />
                            </div>
                        </section>
                    </div>

                </div>
            </div>

        </div>
    );
}

/** ------------------------ UI Helpers ------------------------- */
type StrengthFormProps = {
    exercises: string[];
    exercise: string;
    weight: string;
    setsNum: string;
    reps: string;
    date: string;
    setExercise: (value: string) => void;
    setWeight: (value: string) => void;
    setSetsNum: (value: string) => void;
    setReps: (value: string) => void;
    setDate: (value: string) => void;
    addExercise: () => void;
    removeExercise: () => void;
    recordSet: () => void;
};

function StrengthForm({
    exercises,
    exercise,
    weight,
    setsNum,
    reps,
    date,
    setExercise,
    setWeight,
    setSetsNum,
    setReps,
    setDate,
    addExercise,
    removeExercise,
    recordSet,
}: StrengthFormProps) {
    return (
        <div className="flex flex-col gap-5">
            <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">Exercise</label>
                <div className="mt-1 flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <div className="relative w-full">
                        <select
                            value={exercise}
                            onChange={(e) => setExercise(e.target.value)}
                            className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm font-semibold text-zinc-800 focus:border-green-600 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                        >
                            {exercises.map((ex) => (
                                <option key={ex} value={ex}>
                                    {ex}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-white/80" />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={addExercise}
                            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-50 dark:border-white/20 dark:text-black dark:hover:bg-white/80"
                        >
                            Add
                        </button>
                        <button
                            type="button"
                            onClick={removeExercise}
                            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:bg-red-50 dark:border-white/20 dark:text-black dark:hover:bg-white/80"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                    Weight (lbs)
                    <input
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="Required"
                        className={`rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base font-semibold text-zinc-900 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white ${
                            weight.trim() === '' ? 'text-red-500 placeholder:text-red-400' : ''
                        }`}
                    />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                    Sets
                    <input
                        value={setsNum}
                        onChange={(e) => setSetsNum(e.target.value)}
                        placeholder="Required"
                        className={`rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base font-semibold text-zinc-900 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white ${
                            setsNum.trim() === '' ? 'text-red-500 placeholder:text-red-400' : ''
                        }`}
                    />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                    Reps
                    <input
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        placeholder="Required"
                        className={`rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base font-semibold text-zinc-900 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white ${
                            reps.trim() === '' ? 'text-red-500 placeholder:text-red-400' : ''
                        }`}
                    />
                </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300 sm:col-span-2">
                    Date
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:border-green-600 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                </label>
            </div>

            <button
                type="button"
                onClick={recordSet}
                className="w-full rounded-xl bg-black py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-zinc-900 dark:bg-white dark:text-black dark:hover:bg-white/80"
            >
                Save set
            </button>
        </div>
    );
}

type CardioFormState = {
    activity: CardioMode;
    time: string;
    distance: string;
    calories: string;
    date: string;
};

type CardioFormProps = {
    form: CardioFormState;
    setForm: React.Dispatch<React.SetStateAction<CardioFormState>>;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    distanceUnit: DistanceUnit;
    setDistanceUnit: React.Dispatch<React.SetStateAction<DistanceUnit>>;
};

function CardioForm({ form, setForm, onSubmit, distanceUnit, setDistanceUnit }: CardioFormProps) {
    const update = (field: keyof CardioFormState) => (value: string) => setForm((prev) => ({ ...prev, [field]: value }));
    const activities: CardioMode[] = ['running', 'walking', 'biking', 'swimming'];

    return (
        <>
            <form
                onSubmit={onSubmit}
                className="grid grid-cols-1 gap-3 text-sm text-zinc-700 dark:text-gray-100 sm:grid-cols-2"
            >
                <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                    Activity
                    <div className="relative">
                        <select
                            value={form.activity}
                            onChange={(e) => update('activity')(e.target.value as CardioMode)}
                            className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm font-semibold capitalize text-zinc-800 focus:border-green-600 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white"
                        >
                            {activities.map((activity) => (
                                <option key={activity} value={activity}>
                                    {activity}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-white/80" />
                    </div>
                </label>
                <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                    Date
                    <div className="relative max-sm:w-[19.5rem]">
                        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 sm:block" />
                        <input
                            type="date"
                            value={form.date}
                            onChange={(e) => update('date')(e.target.value)}
                            className="w-full rounded-xl border border-zinc-200 bg-white pl-3 pr-3 py-2 text-sm font-medium text-zinc-800 focus:border-green-600 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white sm:pl-9"
                        />
                    </div>
                </label>
                <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center justify-between">
                        <span>Time (min)</span>
                        <span className="h-5 w-16" />
                    </div>
                    <input
                        value={form.time}
                        onChange={(e) => update('time')(e.target.value)}
                        placeholder="30"
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:border-green-600 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white"
                        required
                    />
                </label>
                <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center justify-between">
                        <span>Distance</span>
                        <span className="inline-flex overflow-hidden rounded-full border border-zinc-200 text-[10px] font-semibold uppercase dark:border-white/15">
                            {(['mi', 'km'] as const).map((unit) => (
                                <button
                                    key={unit}
                                    type="button"
                                    className={`px-2 py-0.5 ${distanceUnit === unit ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-500 dark:text-zinc-300'}`}
                                    onClick={() => setDistanceUnit(unit)}
                                >
                                    {unit}
                                </button>
                            ))}
                        </span>
                    </div>
                    <input
                        value={form.distance}
                        onChange={(e) => update('distance')(e.target.value)}
                        placeholder={distanceUnit === 'km' ? '7.2' : '4.5'}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:border-green-600 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                </label>
                <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Calories
                    <input
                        value={form.calories}
                        onChange={(e) => update('calories')(e.target.value)}
                        placeholder="350"
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:border-green-600 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                </label>
                <div className="sm:col-span-2">
                    <button
                        type="submit"
                        className="w-full rounded-xl bg-black py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-zinc-900 dark:bg-white dark:text-black dark:hover:bg-white/80"
                    >
                        Log session
                    </button>
                </div>
            </form>
        </>
    );
}

type CardioChartProps = {
    width: number;
    height: number;
    data: { labels: string[]; distance: number[]; time: number[]; calories: number[] };
    isDark: boolean;
    onDelete: (sessionId: string) => void;
    distanceUnit: DistanceUnit;
    sessionIdsPerPoint: string[][];
};

function CardioChart({
    width,
    height,
    data,
    isDark,
    onDelete,
    distanceUnit,
    sessionIdsPerPoint,
}: CardioChartProps) {
    const { labels, distance, time, calories } = data;
    const left = 48;
    const right = 52;
    const top = 32;
    const bottom = 28;
    const w = width - left - right;
    const h = height - top - bottom;
    if (!labels.length) {
        return (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-200 text-sm text-zinc-500 dark:border-white/10 dark:text-white/70">
                Log cardio to see trends here.
            </div>
        );
    }

    const distanceSuffix = distanceUnit === 'km' ? ' km' : ' mi';
    const lines = [
        { key: 'distance', values: distance, color: '#16a34a', label: 'Distance', suffix: distanceSuffix },
        { key: 'time', values: time, color: isDark ? '#93c5fd' : '#2563eb', label: 'Time', suffix: ' min' },
        { key: 'calories', values: calories, color: '#f97316', label: 'Calories', suffix: ' kcal' },
    ] as const;

    const maxValue = Math.max(
        1,
        ...distance.map((v) => (Number.isFinite(v) ? v : 0)),
        ...time.map((v) => (Number.isFinite(v) ? v : 0)),
        ...calories.map((v) => (Number.isFinite(v) ? v : 0)),
    );

    const xPositions = labels.map((_, idx) =>
        labels.length > 1 ? left + (idx / (labels.length - 1)) * w : left + w / 2,
    );
    const yScale = (value: number) => top + h - (Math.max(0, value) / maxValue) * h;

    const mkPath = (values: number[]) => {
        let started = false;
        let d = '';
        values.forEach((val, idx) => {
            if (val <= 0 || !Number.isFinite(val)) return;
            const cmd = started ? 'L' : 'M';
            started = true;
            d += `${cmd} ${xPositions[idx] ?? left} ${yScale(val)} `;
        });
        return d.trim();
    };

    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const axisColor = isDark ? '#d4d4d8' : '#475569';

    const svgRef = useRef<SVGSVGElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const [hover, setHover] = useState<{ index: number; svgX: number; svgY: number } | null>(null);

    const updateHover = (clientX: number) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const relX = clientX - rect.left;
        let closestIdx = 0;
        let closestDelta = Number.POSITIVE_INFINITY;
        xPositions.forEach((x, idx) => {
            const delta = Math.abs(x - relX);
            if (delta < closestDelta) {
                closestDelta = delta;
                closestIdx = idx;
            }
        });
        const anchorValues = lines.map((line) => line.values[closestIdx] ?? 0);
        const anchorY = Math.min(...anchorValues.map((val) => yScale(val || 0)));
        setHover({ index: closestIdx, svgX: xPositions[closestIdx] ?? left, svgY: anchorY });
    };

    const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
        updateHover(event.clientX);
    };
    const handleTouchMove = (event: React.TouchEvent<SVGSVGElement>) => {
        if (event.touches[0]) {
            updateHover(event.touches[0].clientX);
        }
    };
    const handleSvgPointerLeave = (event: React.PointerEvent<SVGSVGElement>) => {
        if (event.pointerType === 'touch') return;
        const next = event.relatedTarget;
        if (
            next instanceof Node &&
            tooltipRef.current &&
            tooltipRef.current.contains(next)
        ) {
            return;
        }
        setHover(null);
    };
    const handleTooltipLeave = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'touch') return;
        const next = event.relatedTarget;
        if (next instanceof Node && svgRef.current && svgRef.current.contains(next)) {
            return;
        }
        setHover(null);
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleGlobalPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (
                (svgRef.current && svgRef.current.contains(target)) ||
                (tooltipRef.current && tooltipRef.current.contains(target))
            ) {
                return;
            }
            setHover(null);
        };
        window.addEventListener('pointerdown', handleGlobalPointerDown);
        return () => window.removeEventListener('pointerdown', handleGlobalPointerDown);
    }, []);

    const gridSteps = 4;
    const horizontalLines = Array.from({ length: gridSteps + 1 }, (_, i) => top + (i / gridSteps) * h);

    const tooltipWidth = 190;
    const tooltipHeight = 118;
    const tooltipStyles = hover
        ? {
              left: Math.min(Math.max(hover.svgX - tooltipWidth / 2, 12), width - tooltipWidth - 12),
              top: Math.max(hover.svgY - tooltipHeight - 12, 8),
          }
        : null;

    const hoveredValues =
        hover &&
        lines.map((line) => ({
            key: line.key,
            label: line.label,
            color: line.color,
            value: line.values[hover.index],
            suffix: line.suffix,
        }));
    const sessionIdsForPoint = hover ? sessionIdsPerPoint[hover.index] ?? [] : [];
    const deleteSessionId =
        sessionIdsForPoint.length > 0
            ? sessionIdsForPoint[sessionIdsForPoint.length - 1] ?? sessionIdsForPoint[0]
            : undefined;

    return (
        <div className="relative h-full w-full">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="h-full w-full"
                onPointerMove={handlePointerMove}
                onPointerLeave={handleSvgPointerLeave}
                onTouchStart={handleTouchMove}
                onTouchMove={handleTouchMove}
            >
                <rect x={0} y={0} width={width} height={height} fill="transparent" />
                {horizontalLines.map((y, idx) => (
                    <line
                        key={`h-${idx}`}
                        x1={left}
                        x2={width - right}
                        y1={y}
                        y2={y}
                        stroke={gridColor}
                        strokeDasharray="3 6"
                    />
                ))}
                {labels.length > 0 && (
                    <g>
                        <text
                            x={xPositions[0]}
                            y={height - 6}
                            fontSize="10"
                            textAnchor="start"
                            fill={axisColor}
                        >
                            {labels[0]}
                        </text>
                        {labels.length > 1 && (
                            <text
                                x={xPositions[labels.length - 1]}
                                y={height - 6}
                                fontSize="10"
                                textAnchor="end"
                                fill={axisColor}
                            >
                                {labels[labels.length - 1]}
                            </text>
                        )}
                    </g>
                )}
                <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke={axisColor} strokeWidth={0.5} />
                <line x1={left} x2={left} y1={top} y2={height - bottom} stroke={axisColor} strokeWidth={0.5} />

                {lines.map((line) => (
                    <path
                        key={line.key}
                        d={mkPath(line.values)}
                        fill="none"
                        stroke={line.color}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        opacity={0.9}
                    />
                ))}

                {hover && (
                    <line
                        x1={hover.svgX}
                        x2={hover.svgX}
                        y1={top}
                        y2={height - bottom}
                        stroke={isDark ? '#ffffff40' : '#11182730'}
                        strokeDasharray="4 6"
                    />
                )}

                {lines.map((line) =>
                    line.values.map((val, idx) =>
                        val > 0 ? (
                            <circle
                                key={`${line.key}-point-${idx}`}
                                cx={xPositions[idx]}
                                cy={yScale(val)}
                                r={3}
                                fill={line.color}
                                opacity={0.8}
                            />
                        ) : null,
                    ),
                )}

                {lines.map((line) =>
                    line.values.map((val, idx) =>
                        val > 0 ? (
                            <circle
                                key={`${line.key}-point-${idx}`}
                                cx={xPositions[idx]}
                                cy={yScale(val)}
                                r={3}
                                fill={line.color}
                                opacity={0.85}
                            />
                        ) : null,
                    ),
                )}

                {hover &&
                    lines.map((line) => {
                        const value = line.values[hover.index];
                        if (!value || !Number.isFinite(value)) return null;
                        return (
                            <circle
                                key={`${line.key}-pt`}
                                cx={hover.svgX}
                                cy={yScale(value)}
                                r={5}
                                fill={line.color}
                                stroke={isDark ? '#030712' : '#ffffff'}
                                strokeWidth={2}
                            />
                        );
                    })}
            </svg>

            {hover && tooltipStyles && hoveredValues && (
                <div
                    ref={tooltipRef}
                    className="absolute min-w-[180px] rounded-2xl border border-zinc-200 bg-white/95 p-3 text-xs shadow-lg dark:border-white/10 dark:bg-zinc-900/95"
                    style={{ left: tooltipStyles.left, top: tooltipStyles.top }}
                    onPointerLeave={handleTooltipLeave}
                >
                    <div className="mb-2 flex items-center justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            {labels[hover.index]}
                        </div>
                        {deleteSessionId && (
                            <button
                                type="button"
                                className="rounded-full border border-transparent p-1 text-red-500 hover:border-red-200 hover:bg-red-50 dark:text-red-400 dark:hover:border-red-400/40 dark:hover:bg-red-500/10"
                                onClick={() => onDelete(deleteSessionId)}
                                aria-label="Delete entry"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        {hoveredValues.map(({ key, label, color, value, suffix }) => (
                            <div key={key} className="flex items-center justify-between text-[13px] font-semibold text-zinc-800 dark:text-white">
                                <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                                    {label}
                                </span>
                                <span>{value ? `${value}${suffix}` : '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
