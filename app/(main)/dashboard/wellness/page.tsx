'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import MobileHeader from '@/components/MobileHeader';
import { Moon, Droplet, Flame, Plus, X, Calendar } from 'lucide-react';

import {
    fetchWellnessData,
    upsertSleepServer,
    addWaterServer,
    setWaterGoalServer,
    setWellnessPrefsServer,
    type SleepDTO,
    type WaterDTO,
} from '@/components/wellnessActions';

/* utils */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const fmtISO = (d: Date) => d.toISOString().slice(0, 10);

// (reused from Nutrition page)
function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}
function average(nums: number[]) {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

type SleepPoint = { date: string; hours: number | null };
type WaterPoint = { date: string; liters: number };

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
    goal,
}: {
    data: SleepPoint[];
    range: '1W' | '1M' | '3M' | '1Y';
    onAdd: (pt: SleepPoint) => void | Promise<void>;
    onRange: (r: '1W' | '1M' | '3M' | '1Y') => void;
    goal: number;
}) {
    const svgRef = useRef<SVGSVGElement>(null);
    const { ref: svgWrapRef, width: svgWidth } = useMeasure<HTMLDivElement>();
    const dateInputRef = useRef<HTMLInputElement | null>(null);

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
    }, [data, days, start]);

    // drawing box
    const W = Math.max(360, svgWidth || 780);
    const H = W < 640 ? 240 : 290;
    const pad = { top: 20, right: 20, bottom: 20, left: 44 };
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;

    // dynamic Y-scale based on data + goal
    const hoursVals = xs
        .map((p) => p.hours)
        .filter((v): v is number => v != null && isFinite(v));

    let yMin = 6;
    let yMax = 10;
    const domainVals = [...hoursVals];
    if (isFinite(goal)) domainVals.push(goal);

    if (domainVals.length > 0) {
        let min = Math.min(...domainVals);
        let max = Math.max(...domainVals);

        if (min === max) {
            const padRange = Math.max(0.5, min * 0.1);
            min = min - padRange;
            max = max + padRange;
        } else {
            const padRange = (max - min) * 0.1;
            min -= padRange;
            max += padRange;
        }

        min = Math.max(0, min);
        yMin = min;
        yMax = max;
    }

    const y = (hrs: number) => pad.top + innerH - ((hrs - yMin) / (yMax - yMin || 1)) * innerH;
    const x = (i: number) => pad.left + (i / Math.max(1, xs.length - 1)) * innerW;

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
    }, [nonNull, x, y]);

    const [hover, setHover] = useState<{ i: number; cx: number; cy: number } | null>(null);
    const pointerActive = useRef(false);
    const updateHoverFromClientX = (clientX: number) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return;
        const scaleX = W / rect.width;
        const pointerX = (clientX - rect.left) * scaleX;
        const localX = clamp(pointerX, pad.left, pad.left + innerW);
        const ratio = (localX - pad.left) / innerW;
        const i = Math.round(ratio * (xs.length - 1));
        const safeI = clamp(i, 0, xs.length - 1);
        const h = xs[safeI].hours;
        const safeHours = typeof h === 'number' ? h : yMin;
        setHover({ i: safeI, cx: x(safeI), cy: y(safeHours) });
    };
    const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
        updateHoverFromClientX(e.clientX);
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
        if (e.pointerType === 'mouse' || pointerActive.current) {
            updateHoverFromClientX(e.clientX);
        }
    };
    const endPointerTracking = (e?: React.PointerEvent<SVGSVGElement>) => {
        if (pointerActive.current && e) {
            svgRef.current?.releasePointerCapture(e.pointerId);
        }
        pointerActive.current = false;
    };
    const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        endPointerTracking(e);
    };
    const onPointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
        endPointerTracking(e);
        setHover(null);
    };
    const onPointerLeave = () => {
        pointerActive.current = false;
        setHover(null);
    };

    const hoveredPoint = hover ? xs[hover.i] : null;

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

    // dynamic y ticks
    const tickCount = 4;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / tickCount);

    const RangeButtons = ({ className = '' }: { className?: string }) => (
        <div className={`flex items-center gap-2 ${className}`}>
            {(['1W', '1M', '3M', '1Y'] as const).map((r) => (
                <button
                    key={r}
                    className={`h-8 rounded-full px-3 text-sm ${r === range ? 'bg-black text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
                    onClick={() => onRange(r)}
                >
                    {r}
                </button>
            ))}
        </div>
    );

    return (
        <div className="relative h-full w-full overflow-hidden rounded-xl border bg-white p-4 shadow-sm">
            {/* header - mobile */}
            <div className="flex flex-wrap items-start justify-between gap-3 lg:hidden">
                <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold">Sleep trend</h3>
                    <div className="mt-0.5 text-[11px] text-green-600">avg last 7 days: {avg7.toFixed(1)} hrs</div>
                    <div className="mt-1 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-700">
                            <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
                            Sleep (hrs)
                        </span>
                        <span className="text-xs text-neutral-400">· {range}</span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            aria-label="Add sleep"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                            onClick={() => setOpenAdd((v) => !v)}
                        >
                            {openAdd ? <X size={16} /> : <Plus size={16} />}
                        </button>

                        {/* INLINE expander */}
                        <div
                            className={`${expanderCls} ${
                                openAdd ? 'max-w-[200px] opacity-100 ml-1 sm:max-w-[260px]' : 'max-w-0 opacity-0 ml-0'
                            } lg:hidden`}
                        >
                            <div className="relative h-8 w-8 sm:hidden">
                                <button
                                    type="button"
                                    onClick={() => {
                                        dateInputRef.current?.showPicker?.();
                                        dateInputRef.current?.focus();
                                    }}
                                    className="flex h-full w-full items-center justify-center rounded-lg border text-purple-600"
                                    aria-label="Select date"
                                >
                                    <Calendar size={16} />
                                </button>
                                <input
                                    ref={dateInputRef}
                                    type="date"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="absolute inset-0 opacity-0"
                                />
                            </div>
                            <input
                                ref={dateInputRef}
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="hidden sm:block sm:h-8 sm:w-[120px] sm:rounded-lg sm:border sm:px-2 sm:text-sm sm:outline-none"
                            />
                            <input
                                placeholder="hrs"
                                inputMode="decimal"
                                className="h-8 w-14 rounded-lg border px-2 text-xs outline-none sm:w-20 sm:text-sm"
                                value={newHours}
                                onChange={(e) => setNewHours(e.target.value)}
                            />
                            <button
                                className="h-8 w-8 rounded-lg bg-purple-600 text-white hover:bg-purple-700 sm:w-20 sm:px-3"
                                onClick={async () => {
                                    const h = parseFloat(newHours);
                                    if (!isFinite(h) || h <= 0) return;
                                    await onAdd({ date: newDate, hours: clamp(h, 0, 24) });
                                    setNewHours('');
                                    setOpenAdd(false);
                                }}
                            >
                                <span className="text-lg leading-none sm:hidden">+</span>
                                <span className="hidden text-sm sm:inline">Add</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* header - desktop */}
            <div className="hidden items-center justify-between gap-4 lg:flex">
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
                    <button
                        aria-label="Add sleep"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                        onClick={() => setOpenAdd((v) => !v)}
                    >
                        {openAdd ? <X size={16} /> : <Plus size={16} />}
                    </button>

                    <div
                        className={`${expanderCls} ${
                            openAdd ? 'max-w-[420px] opacity-100 ml-2' : 'max-w-0 opacity-0 ml-0'
                        }`}
                    >
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
                            onClick={async () => {
                                const h = parseFloat(newHours);
                                if (!isFinite(h) || h <= 0) return;
                                await onAdd({ date: newDate, hours: clamp(h, 0, 24) });
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
            <div ref={svgWrapRef} className="relative mt-3 w-full overflow-hidden">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${W} ${H}`}
                    className="h-[270px] w-full"
                    onMouseMove={onMove}
                    onMouseLeave={() => setHover(null)}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerLeave}
                    onPointerCancel={onPointerCancel}
                >
                    {/* grid + y-axis labels */}
                    {yTicks.map((h) => (
                        <g key={h}>
                            <line
                                x1={pad.left}
                                x2={W - pad.right}
                                y1={y(h)}
                                y2={y(h)}
                                stroke="#eee"
                                strokeWidth={1}
                            />
                            <text x={pad.left - 8} y={y(h) + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
                                {h.toFixed(1)}
                            </text>
                        </g>
                    ))}

                    {/* sleep goal line */}
                    {isFinite(goal) && (
                        <>
                            <line
                                x1={pad.left}
                                x2={W - pad.right}
                                y1={y(goal)}
                                y2={y(goal)}
                                stroke="#a855f7"
                                strokeDasharray="4 4"
                                strokeWidth={1.5}
                            />
                            <text
                                x={W - pad.right}
                                y={y(goal) - 4}
                                textAnchor="end"
                                fontSize="10"
                                fill="#7c3aed"
                            >
                                goal {goal.toFixed(1)}h
                            </text>
                        </>
                    )}

                    {/* CONNECTED polyline through non-null points */}
                    {pathD && <path d={pathD} fill="none" stroke="#a855f7" strokeWidth={2} />}

                    {/* light area fill only under data between first & last non-null points */}
                    {nonNull.length >= 2 && (() => {
                        const first = nonNull[0];
                        const last = nonNull[nonNull.length - 1];
                        const firstX = x(first.i);
                        const lastX = x(last.i);
                        const baseY = pad.top + innerH;
                        const areaPath = `${pathD} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
                        return <path d={areaPath} fill="#a855f71a" />;
                    })()}

                    {/* dots only on recorded days */}
                    {xs.map((p, i) => (p.hours != null ? <Dot key={i} cx={x(i)} cy={y(p.hours)} /> : null))}

                    {/* hover guide */}
                    {hover && hoveredPoint && (
                        <>
                            <line
                                x1={hover.cx}
                                x2={hover.cx}
                                y1={pad.top}
                                y2={pad.top + innerH}
                                stroke="#d1d5db"
                                strokeDasharray="4 4"
                            />
                            {hoveredPoint.hours != null && (
                                <Dot cx={hover.cx} cy={y(hoveredPoint.hours)} r={4} color="#7c3aed" />
                            )}
                        </>
                    )}

                    {/* x labels inside */}
                    <text x={pad.left + 2} y={pad.top + innerH + 18} fontSize="10" fill="#9ca3af" textAnchor="start">
                        {xs[0]?.date ?? ''}
                    </text>
                    <text
                        x={pad.left + innerW - 2}
                        y={pad.top + innerH + 18}
                        fontSize="10"
                        fill="#9ca3af"
                        textAnchor="end"
                    >
                        {xs.at(-1)?.date ?? ''}
                    </text>
                </svg>

                {/* tooltip */}
                {hover && hoveredPoint && (
                    <TooltipFlip
                        cx={hover.cx}
                        cy={hover.cy}
                        chartW={W}
                        chartH={H}
                        pad={pad}
                        content={
                            <div className="leading-tight">
                                <div className="font-medium">{hoveredPoint.date}</div>
                                <div>
                                    {hoveredPoint.hours != null
                                        ? `${hoveredPoint.hours.toFixed(1)} hrs`
                                        : '—'}
                                </div>
                            </div>
                        }
                    />
                )}
            </div>

            {/* Mobile range buttons */}
            <div className="mt-3 flex justify-center">
                <RangeButtons className="justify-center" />
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
    }, [data, start]);

    const max = Math.max(2, ...xs.map((d) => d.liters));

    // hover for bars
    const wrapRef = useRef<HTMLDivElement>(null);
    const [hover, setHover] = useState<{ i: number; left: number; top: number } | null>(null);
    const hoveredBar = hover ? xs[hover.i] : null;

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
                        <div
                            className="w-7 rounded-t bg-blue-400/40"
                            style={{ height: `${(d.liters / max) * 100}%` }}
                        />
                        <div className="mt-1 text-[10px] text-neutral-500">{d.date.slice(5)}</div>
                    </div>
                ))}

                {hover && hoveredBar && (
                    <div
                        className="pointer-events-none absolute -translate-x-1/2 rounded-md border bg-white px-2 py-1 text-[11px] shadow-sm"
                        style={{ left: hover.left, top: hover.top }}
                    >
                        <div>{hoveredBar.liters.toFixed(1)} L</div>
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
    rightElement,
}: {
    title: string;
    value: string | number;
    subtitle?: string;
    color?: 'purple' | 'blue' | 'orange';
    icon: React.ReactNode;
    rightElement?: React.ReactNode;
}) {
    const colorClasses =
        color === 'purple'
            ? 'bg-purple-100 text-purple-900'
            : color === 'blue'
                ? 'bg-blue-100 text-blue-900'
                : 'bg-amber-100 text-amber-900';
    return (
        <div className={`rounded-xl p-5 ${colorClasses}`}>
            <div className="mb-2 flex items-center justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/60">
                    {icon}
                </div>
                {rightElement && <div className="ml-2">{rightElement}</div>}
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
    setGoal: (v: number) => void | Promise<void>;
    entries: { date: string; liters: number }[];
    addWater: (liters: number, dateISO: string) => void | Promise<void>;
}) {
    const [selectedDate, setSelectedDate] = useState(fmtISO(new Date()));

    const consumed = entries
        .filter((e) => e.date === selectedDate)
        .reduce((a, b) => a + b.liters, 0);
    const remaining = Math.max(0, goal - consumed);
    const pct = clamp(consumed / Math.max(0.0001, goal), 0, 1);
    const [val, setVal] = useState('');

    const handleAdd = async () => {
        const n = parseFloat(val);
        if (!isFinite(n) || n <= 0) return;
        await addWater(n, selectedDate);
        setVal('');
    };

    const handleRemove = async () => {
        const n = parseFloat(val);
        if (!isFinite(n) || n <= 0) return;
        const amount = Math.min(n, consumed);
        if (amount <= 0) return;
        await addWater(-amount, selectedDate);
        setVal('');
    };

    return (
        <div className="grid h-full grid-rows-[auto_1fr_auto_auto] gap-3 rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Goal: {goal.toFixed(1)} L</div>
                <button
                    className="rounded-full border px-3 py-1 text-sm"
                    onClick={async () => {
                        const s = prompt('Set daily water goal (L):', goal.toString());
                        if (!s) return;
                        const n = parseFloat(s);
                        if (!isFinite(n) || n <= 0) return;
                        await setGoal(clamp(n, 0.1, 10));
                    }}
                >
                    Set
                </button>
            </div>

            {/* Middle area — centers the gauge; +20px height */}
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white/70 p-4">
                <div className="text-sm text-blue-900/80">
                    Remaining: {remaining.toFixed(1)} L
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="relative mx-auto mt-4 flex h-60 w-20 items-end rounded-full bg-blue-50 sm:h-[21rem]">
                        {(() => {
                            const isFull = pct >= 0.999;
                            const radiusClass = isFull
                                ? 'rounded-full'
                                : 'rounded-b-full rounded-t-none';
                            return (
                                <div
                                    className={`absolute left-2 right-2 ${radiusClass} bg-blue-400/30 flex items-center justify-center`}
                                    style={{
                                        height: `calc((100% - 1rem) * ${pct})`,
                                        bottom: '0.5rem',
                                    }}
                                >
                                    {consumed > 0 && (
                                        <div className="text-xs font-medium text-neutral-800 text-center">
                                            {consumed.toFixed(1)} L
                                        </div>
                                    )}
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
                    className="shrink-0 rounded-md border px-3 py-2 text-blue-700 hover:bg-blue-50"
                    onClick={handleAdd}
                >
                    +
                </button>
                <button
                    className="shrink-0 rounded-md border px-3 py-2 text-blue-700 hover:bg-blue-50"
                    onClick={handleRemove}
                >
                    -
                </button>
            </div>

            <div className="flex justify-end">
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                        if (e.target.value) setSelectedDate(e.target.value);
                    }}
                    className="rounded border px-2 py-1 text-xs text-neutral-600 outline-none"
                />
            </div>
        </div>
    );
}

/* ----------------------------------- Page --------------------------------- */
function WellnessPage() {
    // Server-backed state
    const [sleep, setSleep] = useState<SleepPoint[]>([]);
    const [water, setWater] = useState<WaterPoint[]>([]);
    const [range, setRange] = useState<'1W' | '1M' | '3M' | '1Y'>('1W');
    const [waterGoal, setWaterGoal] = useState<number>(3.2);
    const [sleepGoal, setSleepGoal] = useState<number>(8); // sleep goal

    // Load from server (mirrors Nutrition pattern)
    useEffect(() => {
        (async () => {
            try {
                const data = await fetchWellnessData();
                setSleep((data.sleep || []).map((s) => ({ date: s.date, hours: s.hours })));
                setWater((data.water || []).map((w) => ({ date: w.date, liters: w.liters })));
                if (data.settings?.waterGoal) setWaterGoal(data.settings.waterGoal);
                // if server later supports sleepGoal: hydrate here
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    const todayISO = fmtISO(new Date());

    // Persisted mutations
    const addSleep = async (pt: SleepPoint) => {
        try {
            const up = await upsertSleepServer({ date: pt.date, hours: pt.hours });
            setSleep((cur) => {
                const others = cur.filter((x) => x.date !== up.date);
                return [...others, { date: up.date, hours: up.hours }].sort((a, b) =>
                    a.date.localeCompare(b.date)
                );
            });
        } catch (e) {
            console.error(e);
        }
    };

    const addWater = async (liters: number, dateISOParam = todayISO) => {
        try {
            const created = await addWaterServer({ date: dateISOParam, liters });
            setWater((cur) => [...cur, { date: created.date, liters: created.liters }]);
        } catch (e) {
            console.error(e);
        }
    };

    const setGoal = async (next: number) => {
        try {
            const res = await setWaterGoalServer(next);
            setWaterGoal(res.waterGoal);
        } catch (e) {
            console.error(e);
        }
    };

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
        const vals = last7
            .map((d) => map.get(d))
            .filter((v): v is number => v != null && isFinite(v));
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

    const streakDays = useMemo(() => {
        const mapWater = new Map<string, number>();
        water.forEach((w) =>
            mapWater.set(w.date, (mapWater.get(w.date) ?? 0) + w.liters)
        );
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

    const mobileTabs = (
        <div className="px-4 py-3 flex gap-2 text-sm">
            <Link href="/dashboard" className="flex-1 rounded-full px-4 py-2 text-center border text-black">
                workouts
            </Link>
            <Link href="/dashboard/wellness" className="flex-1 rounded-full px-4 py-2 text-center bg-black text-white">
                wellness
            </Link>
            <Link href="/dashboard/nutrition" className="flex-1 rounded-full px-4 py-2 text-center border text-black">
                nutrition
            </Link>
        </div>
    );

    return (
        <div className="flex min-h-screen flex-col bg-[#f8f8f8] xl:h-screen xl:overflow-hidden">
            <MobileHeader title="wellness log" href="/dashboard/wellness" subContent={mobileTabs} />

            <header className="hidden lg:flex w-full items-center justify-between bg-white px-[40px] py-5 flex-none">
                <h1 className="select-none font-roboto text-3xl text-black tracking-tight">
                    wellness log
                </h1>
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
            <main className="mx-auto w-full flex-1 max-w-[1400px] px-4 py-4 flex flex-col gap-6 xl:grid xl:grid-cols-12 xl:h-[calc(100vh-128px)] xl:overflow-y-auto">
                {/* Left column — Sleep bigger, Water smaller */}
                <section className="col-span-12 grid gap-6 xl:col-span-7 xl:grid-rows-[2fr_1fr] overflow-visible">
                    <SleepLine
                        data={sleep}
                        range={range}
                        onAdd={addSleep}
                        onRange={setRange}
                        goal={sleepGoal}
                    />
                    <WaterBars data={water} />
                </section>

                {/* Middle KPIs */}
                <section className="col-span-12 grid gap-6 xl:col-span-3 xl:grid-rows-3 overflow-visible">
                    <KPI
                        title="Hours of sleep (avg last 7d)"
                        value={avgSleep7.toFixed(1)}
                        color="purple"
                        icon={<Moon size={18} className="text-purple-700" />}
                        rightElement={
                            <button
                                className="h-7 rounded-full px-3 text-[11px] text-purple-700 bg-white/60 hover:bg-white/80 border border-transparent"
                                onClick={() => {
                                    const s = prompt('Set sleep goal (hours):', sleepGoal.toString());
                                    if (!s) return;
                                    const n = parseFloat(s);
                                    if (!isFinite(n) || n <= 0 || n > 24) return;
                                    setSleepGoal(clamp(n, 1, 16));
                                }}
                            >
                                Goal {sleepGoal.toFixed(1)}h
                            </button>
                        }
                    />
                    <KPI
                        title="Liters of water (avg last 7d)"
                        value={avgWater7.toFixed(1)}
                        color="blue"
                        icon={<Droplet size={18} className="text-blue-700" />}
                    />
                    <KPI
                        title="Days in a row goals met"
                        value={streakDays}
                        color="orange"
                        icon={<Flame size={18} className="text-amber-700" />}
                    />
                </section>

                {/* Right column */}
                <section className="col-span-12 xl:col-span-2 overflow-visible">
                    <WaterToday
                        goal={waterGoal}
                        setGoal={setGoal}
                        entries={water}
                        addWater={(l, d) => addWater(l, d)}
                    />
                </section>
            </main>
        </div>
    );
}

/* ------------------------------- Bodyweight Chart ------------------------------- */
/** ---------- Small hook for responsive components (reused) ---------- */
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

type BWPoint = { date: string; weight: number };
type RangeKey = '1W' | '1M' | '3M' | '1Y' | 'ALL';
type HMMetric = 'kcal' | 'f' | 'c' | 'p';

/** ---------- Year heatmap (unchanged) ---------- */
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
    const cols = 53,
        rows = 7,
        pad = 8,
        labelTop = 14,
        labelRight = 30,
        gap = 1.8;
    const innerW = width - pad * 2 - labelRight;
    const innerH = height - pad * 2 - labelTop;
    const cell = Math.min(innerW / cols - gap, innerH / rows - gap);

    const today = new Date();
    const todayUTC = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );
    const start = new Date(todayUTC);
    start.setUTCDate(start.getUTCDate() - 364);
    const backToMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - backToMonday);

    const data: { d: Date; key: string; val: number }[] = [];
    for (let i = 0; i < cols * rows; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        const key = fmtISO(d);
        data.push({ d, key, val: valuesByDate[key] || 0 });
    }

    const monthTicks: { label: string; col: number }[] = [];
    const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ];
    for (let i = 0; i < data.length; i++) {
        const { d } = data[i];
        if (d.getUTCDate() === 1) {
            const col = Math.floor(i / 7);
            if (!monthTicks.some((t) => t.col === col))
                monthTicks.push({ label: monthNames[d.getUTCMonth()], col });
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
                    />
                );
            })}

            {monthTicks.map((t, i) => {
                const x = 8 + t.col * (cell + gap) + cell / 2;
                return (
                    <text
                        key={i}
                        x={x}
                        y={18}
                        fontSize="10"
                        textAnchor="middle"
                        fill="#6b7280"
                    >
                        {t.label}
                    </text>
                );
            })}

            {dayLabels.map((lb, ix) => {
                const r = dayIndices[ix];
                const y = 8 + labelTop + r * (cell + gap) + cell * 0.7;
                const x = width - 26;
                return (
                    <text
                        key={lb}
                        x={x}
                        y={y}
                        fontSize="10"
                        textAnchor="start"
                        fill="#6b7280"
                    >
                        {lb}
                    </text>
                );
            })}
        </svg>
    );
}

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

/* ------------------------------- Export ------------------------------- */
export default dynamic(() => Promise.resolve(WellnessPage), { ssr: false });
