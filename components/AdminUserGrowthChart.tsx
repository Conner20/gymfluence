'use client';

import { useState } from "react";

type ChartPoint = {
    date: string;
    label: string;
    total: number;
    active: number;
};

type AdminUserGrowthChartProps = {
    data: ChartPoint[];
};

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value);
}

function formatLongDate(value: string) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(value));
}

function buildPath(data: ChartPoint[], key: "total" | "active", width: number, height: number, padding: number) {
    if (!data.length) return "";

    const maxValue = Math.max(...data.map((point) => Math.max(point.total, point.active)), 1);
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    return data
        .map((point, index) => {
            const x = padding + (innerWidth * index) / Math.max(data.length - 1, 1);
            const y = padding + innerHeight - (point[key] / maxValue) * innerHeight;
            return `${index === 0 ? "M" : "L"}${x} ${y}`;
        })
        .join(" ");
}

export default function AdminUserGrowthChart({ data }: AdminUserGrowthChartProps) {
    const [activeIndex, setActiveIndex] = useState<number | null>(data.length ? data.length - 1 : null);

    if (!data.length) {
        return (
            <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-white px-4 py-10 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                No user history yet.
            </div>
        );
    }

    const chartWidth = 900;
    const chartHeight = 260;
    const padding = 32;
    const innerWidth = chartWidth - padding * 2;
    const innerHeight = chartHeight - padding * 2;
    const maxValue = Math.max(...data.map((point) => Math.max(point.total, point.active)), 1);
    const totalPath = buildPath(data, "total", chartWidth, chartHeight, padding);
    const activePath = buildPath(data, "active", chartWidth, chartHeight, padding);
    const hoveredPoint = activeIndex !== null ? data[activeIndex] : null;

    return (
        <div className="mt-6">
            <div className="relative overflow-x-auto rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-[#0b0b0b]">
                <div className="relative min-w-[720px]">
                    {hoveredPoint && activeIndex !== null && (
                        <div
                            className="pointer-events-none absolute top-3 z-10 w-52 rounded-2xl border border-black/10 bg-white/95 p-3 text-sm shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#0b0b0b]/95"
                            style={{
                                left: `clamp(0px, calc(${((innerWidth * activeIndex) / Math.max(data.length - 1, 1)) + padding}px - 104px), calc(100% - 208px))`,
                            }}
                        >
                            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-white/60">
                                {formatLongDate(hoveredPoint.date)}
                            </p>
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600 dark:text-white/70">Total users</span>
                                    <span className="font-semibold text-black dark:text-white">
                                        {formatNumber(hoveredPoint.total)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600 dark:text-white/70">Active users</span>
                                    <span className="font-semibold text-black dark:text-white">
                                        {formatNumber(hoveredPoint.active)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <svg
                        width={chartWidth}
                        height={chartHeight}
                        className="block h-auto w-full"
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    >
                        <rect x={0} y={0} width={chartWidth} height={chartHeight} fill="transparent" />

                        {[0, 0.5, 1].map((fraction) => {
                            const y = padding + innerHeight * fraction;
                            return (
                                <line
                                    key={fraction}
                                    x1={padding}
                                    x2={chartWidth - padding}
                                    y1={y}
                                    y2={y}
                                    stroke="currentColor"
                                    strokeOpacity={0.08}
                                />
                            );
                        })}

                        <path d={totalPath} fill="none" stroke="#10b981" strokeWidth={3} strokeLinecap="round" />
                        <path d={activePath} fill="none" stroke="#38bdf8" strokeWidth={3} strokeLinecap="round" />

                        {data.map((point, index) => {
                            const x = padding + (innerWidth * index) / Math.max(data.length - 1, 1);
                            const totalY = padding + innerHeight - (point.total / maxValue) * innerHeight;
                            const activeY = padding + innerHeight - (point.active / maxValue) * innerHeight;
                            const isActive = activeIndex === index;

                            return (
                                <g key={point.date}>
                                    <circle
                                        cx={x}
                                        cy={totalY}
                                        r={isActive ? 5 : 3.5}
                                        fill="#10b981"
                                        opacity={isActive ? 1 : 0.9}
                                    />
                                    <circle
                                        cx={x}
                                        cy={activeY}
                                        r={isActive ? 5 : 3.5}
                                        fill="#38bdf8"
                                        opacity={isActive ? 1 : 0.9}
                                    />
                                    <rect
                                        x={x - 12}
                                        y={padding}
                                        width={24}
                                        height={innerHeight}
                                        fill="transparent"
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onMouseMove={() => setActiveIndex(index)}
                                        onTouchStart={() => setActiveIndex(index)}
                                    />
                                </g>
                            );
                        })}

                        <text
                            x={padding}
                            y={chartHeight - 8}
                            fontSize={11}
                            fill="#6b7280"
                            textAnchor="start"
                        >
                            {data[0]?.label}
                        </text>
                        <text
                            x={chartWidth - padding}
                            y={chartHeight - 8}
                            fontSize={11}
                            fill="#6b7280"
                            textAnchor="end"
                        >
                            {data[data.length - 1]?.label}
                        </text>
                    </svg>
                </div>
            </div>
        </div>
    );
}
