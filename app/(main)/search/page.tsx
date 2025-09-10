"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    MapPin,
    MessageSquare,
    Search,
    Share2,
    X,
    ChevronDown,
    Home,
    DollarSign,
    Target,
    UserCircle2,
} from "lucide-react";
import clsx from "clsx";
import Navbar from "@/components/Navbar";

type Role = "ALL" | "TRAINEE" | "TRAINER" | "GYM";

type ResultItem = {
    id: string;
    username: string | null;
    name: string | null;
    image: string | null;
    role: "TRAINEE" | "TRAINER" | "GYM";
    isPrivate: boolean;
    location: string | null;
    price: number | null; // trainer hourlyRate / gym fee
    city: string | null;
    state: string | null;
    country: string | null;
    goals?: string[] | null;
    services?: string[] | null;
    rating?: number | null;
    clients?: number | null;
    amenities?: string[] | null;
    distanceKm: number | null;
};

const GOAL_OPTIONS = [
    "weight loss",
    "build strength",
    "improve endurance",
    "flexibility & mobility",
    "sport performance",
    "injury recovery",
];

const DISTANCE_OPTIONS = [
    { label: "any distance", km: 0 },
    { label: "5 mi", km: 8 },
    { label: "10 mi", km: 16 },
    { label: "25 mi", km: 40 },
    { label: "50 mi", km: 80 },
    { label: "100 mi", km: 160 },
];

const PAGE_SIZE = 10;

export default function SearchPage() {
    const router = useRouter();

    // --------- Filters ----------
    const [q, setQ] = useState("");
    const [role, setRole] = useState<Role>("ALL");
    const [distanceKm, setDistanceKm] = useState<number>(0);
    const [minBudget, setMinBudget] = useState<string>("");
    const [maxBudget, setMaxBudget] = useState<string>("");
    const [goals, setGoals] = useState<string[]>([]);

    const [page, setPage] = useState(1);

    // --------- Data ----------
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<ResultItem[]>([]);
    const [total, setTotal] = useState(0);
    const [viewerHasCoords, setViewerHasCoords] = useState<boolean>(true);

    const [selected, setSelected] = useState<ResultItem | null>(null);
    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

    // Debounced fetch
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);

        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (role !== "ALL") params.set("role", role);
        if (distanceKm > 0) params.set("distanceKm", String(distanceKm));
        if (minBudget.trim()) params.set("minBudget", String(Number(minBudget) || 0));
        if (maxBudget.trim()) params.set("maxBudget", String(Number(maxBudget) || Number.POSITIVE_INFINITY));
        if (goals.length) params.set("goals", goals.join(","));
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));

        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?${params.toString()}`, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                setResults(data.results || []);
                setTotal(data.total || 0);
                setViewerHasCoords(!!data.viewerHasCoords);
                // keep selection in view if still present
                if (selected) {
                    const still = (data.results || []).find((r: ResultItem) => r.id === selected.id);
                    setSelected(still || null);
                }
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => {
            controller.abort();
            clearTimeout(t);
        };
    }, [q, role, distanceKm, minBudget, maxBudget, goals, page]);

    // Reset to page 1 when filters change (except page itself)
    useEffect(() => {
        setPage(1);
    }, [q, role, distanceKm, minBudget, maxBudget, goals]);

    const resetAll = () => {
        setQ("");
        setRole("ALL");
        setDistanceKm(0);
        setMinBudget("");
        setMaxBudget("");
        setGoals([]);
        setPage(1);
    };

    const roleLabel = (r: ResultItem["role"]) =>
        r === "TRAINEE" ? "personal trainee" : r === "TRAINER" ? "personal trainer" : "gym";

    // ---------- UI ----------
    return (
        <div className="min-h-screen bg-[#f8f8f8] px-6 pb-8">
            {/* Top bar */}
            <header className="sticky top-0 z-10 bg-[#f8f8f8] pt-6 pb-4">
                <div className="max-w-[1180px] mx-auto flex items-center gap-3">
                    <div className="text-3xl text-green-700 font-medium mr-2">search</div>

                    {/* Search input */}
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            className="w-full pl-9 pr-3 h-10 rounded-full border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                            placeholder="Search by name or username…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>

                    {/* Distance */}
                    <FilterPill icon={<MapPin size={16} />} label="distance">
                        <div className="p-2 w-40">
                            {DISTANCE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.km}
                                    className={clsx(
                                        "w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-100",
                                        distanceKm === opt.km && "bg-gray-100"
                                    )}
                                    onClick={() => setDistanceKm(opt.km)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </FilterPill>

                    {/* Entity */}
                    <FilterPill icon={<UserCircle2 size={16} />} label="entity">
                        <div className="p-2 w-40">
                            {(["ALL", "TRAINEE", "TRAINER", "GYM"] as Role[]).map((r) => (
                                <button
                                    key={r}
                                    className={clsx(
                                        "w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-100",
                                        role === r && "bg-gray-100"
                                    )}
                                    onClick={() => setRole(r)}
                                >
                                    {r === "ALL" ? "all" : r.toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </FilterPill>

                    {/* Budget */}
                    <FilterPill icon={<DollarSign size={16} />} label="budget">
                        <div className="p-3 w-64">
                            <div className="text-xs text-gray-500 mb-1">trainer hourly / gym monthly</div>
                            <div className="flex items-center gap-2">
                                <input
                                    className="w-24 border rounded px-2 py-1 text-sm"
                                    placeholder="min"
                                    inputMode="numeric"
                                    value={minBudget}
                                    onChange={(e) => setMinBudget(e.target.value)}
                                />
                                <span className="text-gray-400">—</span>
                                <input
                                    className="w-24 border rounded px-2 py-1 text-sm"
                                    placeholder="max"
                                    inputMode="numeric"
                                    value={maxBudget}
                                    onChange={(e) => setMaxBudget(e.target.value)}
                                />
                            </div>
                        </div>
                    </FilterPill>

                    {/* Goals / Services */}
                    <FilterPill icon={<Target size={16} />} label="goals">
                        <div className="p-2 w-64 max-h-64 overflow-y-auto">
                            {GOAL_OPTIONS.map((g) => {
                                const checked = goals.includes(g);
                                return (
                                    <label key={g} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) =>
                                                setGoals((prev) =>
                                                    e.target.checked ? [...prev, g] : prev.filter((x) => x !== g)
                                                )
                                            }
                                        />
                                        <span>{g}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </FilterPill>

                    {/* Reset */}
                    <button
                        onClick={resetAll}
                        className="ml-1 text-sm px-3 h-10 rounded-full border bg-white hover:bg-gray-50"
                        title="Reset all filters"
                    >
                        Reset
                    </button>
                </div>

                {!viewerHasCoords && distanceKm > 0 && (
                    <div className="max-w-[1180px] mx-auto mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        Distance filter works best when your profile has a city (or coordinates). Add your city in
                        <button
                            className="underline ml-1 hover:text-amber-900"
                            onClick={() => router.push("/settings")}
                        >
                            Settings → Profile
                        </button>
                        .
                    </div>
                )}
            </header>

            {/* Body */}
            <div className="max-w-[1180px] mx-auto grid grid-cols-[380px,1fr] gap-6">
                {/* Left: results list */}
                <aside className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    {/* rows */}
                    <div className="divide-y">
                        {loading && results.length === 0 ? (
                            <div className="p-4 text-sm text-gray-500">Searching…</div>
                        ) : results.length === 0 ? (
                            <div className="p-4 text-sm text-gray-400">No results.</div>
                        ) : (
                            results.map((r) => {
                                const active = selected?.id === r.id;
                                return (
                                    <button
                                        key={r.id}
                                        className={clsx(
                                            "w-full p-3 flex items-center gap-3 hover:bg-gray-50",
                                            active && "bg-gray-100"
                                        )}
                                        onClick={() => setSelected(r)}
                                    >
                                        <Avatar url={r.image} name={r.username || r.name || "User"} />
                                        <div className="min-w-0 text-left">
                                            <div className="text-sm font-medium truncate">
                                                {r.username || r.name || "User"}
                                                {r.isPrivate && <span className="ml-1 text-[11px] text-gray-500">(private)</span>}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">
                                                {roleLabel(r)} • {r.city || r.location || "—"}
                                            </div>
                                            {r.price != null && (
                                                <div className="text-xs text-gray-600">
                                                    {r.role === "TRAINER" ? `$${r.price}/hr` : `$${r.price}/mo`}
                                                </div>
                                            )}
                                        </div>
                                        {r.distanceKm != null && (
                                            <div className="ml-auto text-xs text-gray-500">{Math.round(r.distanceKm)} km</div>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Paging */}
                    <div className="border-t px-3 py-2 flex items-center justify-between">
                        <button
                            className="text-sm px-2 py-1 rounded border bg-white disabled:opacity-40"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            ‹ Prev
                        </button>
                        <div className="text-xs text-gray-500">
                            Page {page} / {totalPages}
                        </div>
                        <button
                            className="text-sm px-2 py-1 rounded border bg-white disabled:opacity-40"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            Next ›
                        </button>
                    </div>
                </aside>

                {/* Right: detail */}
                <section className="bg-white rounded-xl border shadow-sm p-6 min-h-[520px]">
                    {!selected ? (
                        <div className="text-gray-400 text-sm">Select a result to see details.</div>
                    ) : (
                        <DetailCard r={selected} onMessage={() => router.push(`/messages?to=${encodeURIComponent(selected.username || selected.id)}`)} />
                    )}
                </section>
            </div>
            <Navbar />
        </div>
    );
}

/* ----------------- Pieces ----------------- */

function Avatar({ url, name }: { url: string | null; name: string }) {
    if (url) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={url} alt={name} className="w-10 h-10 rounded-full object-cover border" />;
    }
    return (
        <div className="w-10 h-10 rounded-full bg-gray-200 border flex items-center justify-center text-xs font-medium text-gray-700">
            {(name || "U").slice(0, 2).toUpperCase()}
        </div>
    );
}

function FilterPill({
    icon,
    label,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                className="h-10 px-3 rounded-full border bg-white text-sm flex items-center gap-1 hover:bg-gray-50"
                title={label}
            >
                {icon}
                <span className="capitalize">{label}</span>
                <ChevronDown size={16} className="opacity-60" />
            </button>
            {open && (
                <div
                    className="absolute z-20 mt-2 bg-white border rounded-xl shadow-lg"
                    onMouseLeave={() => setOpen(false)}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

function DetailCard({
    r,
    onMessage,
}: {
    r: ResultItem;
    onMessage: () => void;
}) {
    const title = r.username || r.name || "User";
    const sub = `${r.city || r.location || "Unknown"}${r.role === "TRAINER" && r.price != null ? ` • $${r.price}/hr` : ""}${r.role === "GYM" && r.price != null ? ` • $${r.price}/mo` : ""
        }`;

    return (
        <>
            <div className="flex items-start gap-4">
                <Avatar url={r.image} name={title} />
                <div className="min-w-0">
                    <div className="text-2xl font-semibold">{title}</div>
                    <div className="text-sm text-gray-500">{sub}</div>
                    <div className="text-sm text-gray-500">{r.role === "TRAINEE" ? "Personal Trainee" : r.role === "TRAINER" ? "Personal Trainer" : "Gym"}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        className="px-2.5 py-1.5 rounded-full border bg-white hover:bg-gray-50"
                        title="Message"
                        onClick={onMessage}
                    >
                        <MessageSquare size={18} />
                    </button>
                    <button
                        className="px-2.5 py-1.5 rounded-full border bg-white hover:bg-gray-50"
                        title="Copy profile link"
                        onClick={async () => {
                            const slug = r.username || r.id;
                            const url = `${window.location.origin}/u/${encodeURIComponent(slug)}`;
                            try {
                                await navigator.clipboard.writeText(url);
                                alert("Profile link copied!");
                            } catch {
                                alert(url);
                            }
                        }}
                    >
                        <Share2 size={18} />
                    </button>
                </div>
            </div>

            <hr className="my-4" />

            {/* About */}
            <div className="mb-4">
                <div className="font-medium mb-1">About {title}</div>
                <div className="text-sm text-gray-700">
                    {r.role === "TRAINER" && r.services?.length ? (
                        <>
                            <span className="text-gray-500">Services:</span> {r.services.join(" • ")}
                            {r.rating != null && (
                                <span className="ml-3 text-gray-500">Rating:</span>
                            )}
                            {r.rating != null && <span className="ml-1">{r.rating.toFixed(1)}</span>}
                            {r.clients != null && (
                                <>
                                    <span className="ml-3 text-gray-500">Clients:</span>
                                    <span className="ml-1">{r.clients}</span>
                                </>
                            )}
                        </>
                    ) : r.role === "TRAINEE" && r.goals?.length ? (
                        <>
                            <span className="text-gray-500">Goals:</span> {r.goals.join(" • ")}
                        </>
                    ) : r.role === "GYM" && r.amenities?.length ? (
                        <>
                            <span className="text-gray-500">Amenities:</span> {r.amenities.join(" • ")}
                        </>
                    ) : (
                        <span className="text-gray-500">No additional details provided.</span>
                    )}
                </div>
            </div>

            {/* Location & distance */}
            <div className="text-sm text-gray-600 flex items-center gap-2">
                <MapPin size={16} className="opacity-70" />
                <span>
                    {r.city || r.location || "Unknown"}
                    {r.state ? `, ${r.state}` : ""}
                    {r.country ? `, ${r.country}` : ""}
                </span>
                {r.distanceKm != null && <span className="ml-2 text-gray-400">• ~{Math.round(r.distanceKm)} km away</span>}
            </div>
        </>
    );
}
