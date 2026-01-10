'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, ChevronDown, X, MessageSquare, Share2, Star } from 'lucide-react';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import MobileHeader from "@/components/MobileHeader";

type Role = 'TRAINEE' | 'TRAINER' | 'GYM';

type SearchUser = {
    id: string;
    username: string | null;
    name: string | null;
    image: string | null;
    role: Role | null;
    isPrivate: boolean;
    location: string | null;

    city: string | null;
    state: string | null;
    country: string | null;
    distanceKm: number | null;

    price: number | null;

    goals: string[] | null;
    services: string[] | null;
    amenities: string[] | null;
    amenitiesText?: string | null; // NEW: free-form amenities description
    rating: number | null;
    clients: number | null;

    about?: string | null;
    gallery?: string[];
};

type ApiResponse = {
    page: number;
    pageSize: number;
    total: number;
    results: SearchUser[];
    viewerHasCoords: boolean;
};

export default function SearchPage() {
    const router = useRouter();

    // ------- filters -------
    const [q, setQ] = useState('');
    const [role, setRole] = useState<'ALL' | Role>('ALL');
    const [minBudget, setMinBudget] = useState('');
    const [maxBudget, setMaxBudget] = useState('');
    const [distanceKm, setDistanceKm] = useState('');
    const [goals, setGoals] = useState<string[]>([]);

    // data
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ApiResponse | null>(null);
    const [mobileView, setMobileView] = useState<'list' | 'details'>('list');
    const pageSize = 10;
    const [page, setPage] = useState(1);
    const listRef = useRef<HTMLDivElement | null>(null);
    const mobileListRef = useRef<HTMLDivElement | null>(null);

    // selection for details panel
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = useMemo(
        () => data?.results.find((u) => u.id === selectedId) ?? null,
        [data, selectedId]
    );

    // lightbox (image enlarge)
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    // ensure portal only runs client-side
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const fetchResults = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (q.trim()) params.set('q', q.trim());
            if (role !== 'ALL') params.set('role', role);
            if (minBudget) params.set('minBudget', minBudget);
            if (maxBudget) params.set('maxBudget', maxBudget);
            if (distanceKm) params.set('distanceKm', distanceKm);
            if (goals.length) params.set('goals', goals.join(','));
            params.set('page', '1');
            params.set('pageSize', '1000');

            const res = await fetch(`/api/search?${params.toString()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const json: ApiResponse = await res.json();
            setData(json);
            setPage(1);
            setMobileView('list');

            setSelectedId((prev) => (prev && json.results.some((r) => r.id === prev) ? prev : json.results[0]?.id ?? null));
        } catch {
            setError('Failed to load results.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResults();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const t = setTimeout(fetchResults, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, role, minBudget, maxBudget, distanceKm, goals]);

    const resetFilters = () => {
        setQ('');
        setRole('ALL');
        setMinBudget('');
        setMaxBudget('');
        setDistanceKm('');
        setGoals([]);
        setPage(1);
    };

    const toggleGoal = (g: string) =>
        setGoals((old) => (old.includes(g) ? old.filter((x) => x !== g) : [...old, g]));

    const allGoals = [
        'weight loss',
        'build strength',
        'improve endurance',
        'flexibility & mobility',
        'sport performance',
        'injury recovery',
    ];

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('close-filters', { detail: selected?.id || '' }));
        const total = Math.max(
            1,
            Math.ceil(((data?.results?.length ?? 0) || 0) / pageSize)
        );
        if (page > total) setPage(total);
    }, [data?.results?.length, page, pageSize]);

    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = 0;
        if (mobileListRef.current) mobileListRef.current.scrollTop = 0;
    }, [page, mobileView]);

    // actions
    const handleMessage = (u: SearchUser) => {
        const to = u.username || u.id;
        router.push(`/messages?to=${encodeURIComponent(to)}`);
    };

    const handleShareProfile = (u: SearchUser) => {
        const pretty = u.username || u.id;
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const profileUrl = `${origin}/u/${pretty}`;
        const shareLabel = u.name || u.username || 'User';
        router.push(
            `/messages?shareType=profile&shareUrl=${encodeURIComponent(profileUrl)}&shareLabel=${encodeURIComponent(shareLabel)}&shareUserId=${encodeURIComponent(u.id)}`
        );
    };

    // close lightbox on ESC
    useEffect(() => {
        if (!lightboxUrl) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightboxUrl(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxUrl]);

    const mobileFilters = (
        <div className="px-4 py-4 space-y-2">
            <div className="flex items-center gap-2 rounded-full border px-3 py-2">
                <SearchIcon size={18} className="text-gray-500" />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="flex-1 outline-none text-sm"
                    placeholder="Search by name or @username…"
                />
            </div>
            <div className="flex gap-2 flex-nowrap overflow-x-auto">
                <div className="shrink-0">
                    <Chip
                        label="Distance"
                        value={distanceKm ? `${distanceKm} km` : 'Any'}
                        menu={
                            <div className="flex flex-col gap-1 p-3">
                                {['', '5', '10', '25', '50', '100'].map((d) => {
                                    const activeOpt = (distanceKm || '') === d;
                                    return (
                                        <button
                                            key={d || 'any'}
                                            onClick={() => setDistanceKm(d)}
                                            className={clsx(
                                                'rounded-2xl border px-3 py-2 text-sm text-left transition',
                                                activeOpt
                                                    ? 'border-gray-900 bg-gray-900 text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50'
                                            )}
                                        >
                                            {d ? `${d} km` : 'Any distance'}
                                        </button>
                                    );
                                })}
                            </div>
                        }
                        size="compact"
                        fluid
                        showValue={false}
                        active={Boolean(distanceKm)}
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                    />
                </div>
                <div className="shrink-0">
                    <Chip
                        label="Role"
                        value={role === 'ALL' ? 'All' : role.toLowerCase()}
                        menu={
                            <div className="flex flex-col gap-1 p-3">
                                {(['ALL', 'TRAINEE', 'TRAINER', 'GYM'] as const).map((r) => {
                                    const activeOpt = role === r;
                                    return (
                                        <button
                                            key={r}
                                            onClick={() => setRole(r)}
                                            className={clsx(
                                                'rounded-2xl border px-3 py-2 text-sm text-left transition capitalize',
                                                activeOpt
                                                    ? 'border-gray-900 bg-gray-900 text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50'
                                            )}
                                        >
                                            {r === 'ALL' ? 'any role' : r.toLowerCase()}
                                        </button>
                                    );
                                })}
                            </div>
                        }
                        size="compact"
                        fluid
                        showValue={false}
                        active={role !== 'ALL'}
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                    />
                </div>
                <div className="shrink-0">
                    <Chip
                        label="Budget"
                        value={`${minBudget || 0}–${maxBudget || '∞'}`}
                        menu={
                            <div className="space-y-3 p-4 text-sm">
                                <div className="text-xs uppercase tracking-wide text-gray-400">
                                    trainers hourly · gyms monthly
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-24 flex-1 rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
                                        placeholder="Min"
                                        value={minBudget}
                                        onChange={(e) => setMinBudget(e.target.value)}
                                    />
                                    <span className="text-gray-400">—</span>
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-24 flex-1 rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
                                        placeholder="Max"
                                        value={maxBudget}
                                        onChange={(e) => setMaxBudget(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <button
                                        onClick={() => {
                                            setMinBudget('');
                                            setMaxBudget('');
                                        }}
                                        className="rounded-full px-2 py-1 transition hover:text-gray-800"
                                    >
                                        Clear
                                    </button>
                                    <span>
                                        {minBudget || '0'} – {maxBudget || '∞'}
                                    </span>
                                </div>
                            </div>
                        }
                        size="compact"
                        fluid
                        showValue={false}
                        active={Boolean(minBudget || maxBudget)}
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                    />
                </div>
                <div className="shrink-0">
                    <Chip
                        label="Goals"
                        value={goals.length ? `${goals.length} selected` : 'Any'}
                        menu={
                            <div className="flex flex-col gap-1 p-3 text-sm">
                                {allGoals.map((g) => {
                                    const checked = goals.includes(g);
                                    return (
                                        <label
                                            key={g}
                                            className={clsx(
                                                'flex items-center gap-2 rounded-2xl border px-3 py-2 transition capitalize',
                                                checked
                                                    ? 'border-gray-900 bg-gray-900 text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleGoal(g)}
                                                className="accent-gray-900"
                                            />
                                            <span>{g}</span>
                                        </label>
                                    );
                                })}
                                <button
                                    onClick={() => setGoals([])}
                                    className="mt-2 text-right text-xs text-gray-500 transition hover:text-gray-800"
                                >
                                    Clear goals
                                </button>
                            </div>
                        }
                        size="compact"
                        fluid
                        showValue={false}
                        active={goals.length > 0}
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                    />
                </div>
            </div>
        </div>
    );

    const handleMobileSelect = (userId: string) => {
        setSelectedId(userId);
        setMobileView('details');
    };

    const renderMobileCard = (u: SearchUser) => {
        const isSelected = selectedId === u.id;
        return (
            <button
                key={`mobile-${u.id}`}
                className={clsx(
                    "w-full rounded-2xl border bg-white px-4 py-4 text-left transition focus-visible:outline-none shadow-sm",
                    isSelected && "border-2 border-gray-900"
                )}
                onClick={() => handleMobileSelect(u.id)}
            >
                <div className="flex items-start gap-3">
                    {u.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.image} alt="" className="h-12 w-12 rounded-full object-cover border" />
                    ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-100 border flex items-center justify-center text-sm font-semibold">
                            {(u.username || u.name || 'U').slice(0, 2).toUpperCase()}
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-sm font-semibold leading-tight">
                                        {u.name || u.username || 'User'}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        @{u.username || u.id.slice(0, 8)}
                                    </div>
                                </div>

                                <div className="text-right text-xs text-gray-500 space-y-0.5">
                                    {u.role && <div className="uppercase tracking-wide">{u.role.toLowerCase()}</div>}
                                    {u.clients != null && (
                                        <div className="flex items-center justify-end gap-1">
                                            <span>{u.clients}</span>
                                            <span className="text-gray-400">clients</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
                                {(u.city || u.state) && (
                                    <span>
                                        {u.city}
                                        {u.state ? `, ${u.state}` : ''}
                                    </span>
                                )}
                                {u.price != null && (
                                    <span>
                                        {(u.city || u.state) ? '· ' : ''}
                                        {u.role === 'TRAINER'
                                            ? `$${u.price}/hr`
                                            : u.role === 'GYM'
                                                ? `$${u.price}/mo`
                                                : `$${u.price}`}
                                    </span>
                                )}
                                {typeof u.distanceKm === 'number' && (
                                    <span>· {u.distanceKm.toFixed(1)} km away</span>
                                )}
                            </div>

                            <div className="text-xs text-gray-600 line-clamp-2">
                                {u.about?.trim()
                                    ? u.about
                                    : `@${u.username || (u.name || '').toLowerCase().replace(/\s+/g, '')}`}
                            </div>
                        </div>
                    </div>
                </div>
            </button>
        );
    };

    const allResults = data?.results ?? [];
    const totalPages = Math.max(1, Math.ceil(allResults.length / pageSize));
    const startIdx = (page - 1) * pageSize;
    const paginatedResults = allResults.slice(startIdx, startIdx + pageSize);

    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col overflow-x-hidden">
            <MobileHeader title="search" href="/search" subContent={mobileFilters} />

            {/* Desktop header */}
            <header className="hidden lg:block sticky top-0 z-20 w-full bg-white">
                <div className="mx-auto max-w-[1400px] w-full flex items-center gap-4 py-6 pl-[40px] pr-4">
                    <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                        <span>search</span>
                    </h1>

                    <div className="flex items-center gap-3 flex-1 justify-end">
                        <div className="flex items-center gap-2 flex-1 max-w-[520px] rounded-full border px-3 py-2">
                            <SearchIcon size={18} className="text-gray-500" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                className="flex-1 outline-none text-sm"
                                placeholder="Search by name or @username…"
                            />
                        </div>

                        <Chip
                            label="Distance"
                            value={distanceKm ? `${distanceKm} km` : 'Any'}
                            active={Boolean(distanceKm)}
                            menu={
                                <div className="flex flex-col gap-1 p-3 w-60">
                                    {['', '5', '10', '25', '50', '100'].map((d) => {
                                        const activeOpt = (distanceKm || '') === d;
                                        return (
                                            <button
                                                key={d || 'any'}
                                                onClick={() => setDistanceKm(d)}
                                                className={clsx(
                                                    'rounded-2xl border px-3 py-2 text-sm text-left transition',
                                                    activeOpt
                                                        ? 'border-gray-900 bg-gray-900 text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50'
                                                )}
                                            >
                                                {d ? `${d} km` : 'Any distance'}
                                            </button>
                                        );
                                    })}
                                </div>
                            }
                        />

                        <Chip
                            label="Role"
                            value={role === 'ALL' ? 'All' : role.toLowerCase()}
                            active={role !== 'ALL'}
                            menu={
                                <div className="flex flex-col gap-1 p-3 w-60">
                                    {(['ALL', 'TRAINEE', 'TRAINER', 'GYM'] as const).map((r) => {
                                        const activeOpt = role === r;
                                        return (
                                            <button
                                                key={r}
                                                onClick={() => setRole(r)}
                                                className={clsx(
                                                    'rounded-2xl border px-3 py-2 text-sm text-left transition capitalize',
                                                    activeOpt
                                                        ? 'border-gray-900 bg-gray-900 text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50'
                                                )}
                                            >
                                                {r === 'ALL' ? 'any role' : r.toLowerCase()}
                                            </button>
                                        );
                                    })}
                                </div>
                            }
                        />


                        <Chip
                            label="Budget"
                            value={`${minBudget || 0}–${maxBudget || '∞'}`}
                            active={Boolean(minBudget || maxBudget)}
                            menu={
                                <div className="space-y-3 p-4 w-[22rem] max-w-[calc(100vw-80px)] text-sm">
                                    <div className="text-xs uppercase tracking-wide text-gray-400">
                                        trainers hourly · gyms monthly
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            className="flex-1 min-w-[110px] rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
                                            placeholder="Min"
                                            value={minBudget}
                                            onChange={(e) => setMinBudget(e.target.value)}
                                        />
                                        <span className="text-gray-400">—</span>
                                        <input
                                            type="number"
                                            min={0}
                                            className="flex-1 min-w-[110px] rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
                                            placeholder="Max"
                                            value={maxBudget}
                                            onChange={(e) => setMaxBudget(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <button
                                            onClick={() => {
                                                setMinBudget('');
                                                setMaxBudget('');
                                            }}
                                            className="rounded-full px-2 py-1 transition hover:text-gray-800"
                                        >
                                            Clear
                                        </button>
                                        <span>
                                            {minBudget || '0'} – {maxBudget || '∞'}
                                        </span>
                                    </div>
                                </div>
                            }
                        />

                        <Chip
                            label="Goals"
                            value={goals.length ? `${goals.length} selected` : 'Any'}
                            active={goals.length > 0}
                            menu={
                                <div className="flex flex-col gap-1 p-3 text-sm w-64">
                                    {allGoals.map((g) => {
                                        const checked = goals.includes(g);
                                        return (
                                            <label
                                                key={g}
                                                className={clsx(
                                                    'flex items-center gap-2 rounded-2xl border px-3 py-2 transition capitalize',
                                                    checked
                                                        ? 'border-gray-900 bg-gray-900 text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50'
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleGoal(g)}
                                                    className="accent-gray-900"
                                                />
                                                <span>{g}</span>
                                            </label>
                                        );
                                    })}
                                    <button
                                        onClick={() => setGoals([])}
                                        className="mt-2 text-right text-xs text-gray-500 transition hover:text-gray-800"
                                    >
                                        Clear goals
                                    </button>
                                </div>
                            }
                        />

                        <button
                            onClick={resetFilters}
                            className="flex items-center rounded-xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm text-gray-700 uppercase tracking-wide transition hover:border-gray-400 hover:bg-white"
                            title="Reset filters"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </header>

            <main className="w-full flex-1">
                <div className="lg:hidden">
                    {mobileView === 'list' && (
                        <div className="px-4 py-4 space-y-4">
                            {loading ? (
                                <div className="p-4 text-sm text-gray-500 bg-white rounded-xl border">Loading…</div>
                            ) : error ? (
                                <div className="p-4 text-sm text-red-500 bg-white rounded-xl border">{error}</div>
                            ) : allResults.length ? (
                                <>
                                    <div
                                        className="space-y-3 max-h-[70vh] overflow-y-auto"
                                        ref={mobileListRef}
                                    >
                                        {paginatedResults.map((u) => renderMobileCard(u))}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-600">
                                        <button
                                            className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-40"
                                            disabled={page === 1}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        >
                                            Previous
                                        </button>
                                        <span>
                                            Page {page} of {totalPages}
                                        </span>
                                        <button
                                            className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-40"
                                            disabled={page === totalPages}
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="p-4 text-sm text-gray-500 bg-white rounded-xl border">No results.</div>
                            )}
                        </div>
                    )}

                    {mobileView === 'details' && (
                        <div className="px-4 py-4">
                            <button
                                onClick={() => setMobileView('list')}
                                className="mb-3 inline-flex items-center gap-2 text-sm text-green-700"
                            >
                                <span className="text-lg">&larr;</span> Back
                            </button>
                            <div className="bg-white border rounded-xl p-4 overflow-hidden">
                                {!selected ? (
                                    <div className="text-gray-500 text-sm">Select a result to see details.</div>
                                ) : (
                                    <UserDetails
                                        u={selected}
                                        onMessage={handleMessage}
                                        onShare={handleShareProfile}
                                        onOpenImage={(url) => setLightboxUrl(url)}
                                        variant="mobile"
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="hidden lg:block">
                    <div className="mx-auto max-w-[1400px] px-4 py-4">
                        <div className="flex gap-6">
                            <aside className="w-[380px] shrink-0">
                                <div className="bg-white border rounded-xl overflow-hidden lg:h-[calc(100vh-190px)] lg:flex lg:flex-col">
                                    <div
                                        ref={listRef}
                                        className="overflow-y-auto divide-y lg:flex-1 lg:min-h-0"
                                    >
                                        {loading ? (
                                            <div className="p-4 text-sm text-gray-500">Loading…</div>
                                        ) : error ? (
                                            <div className="p-4 text-sm text-red-500">{error}</div>
                                        ) : allResults.length === 0 ? (
                                            <div className="p-4 text-sm text-gray-500">No results.</div>
                                        ) : (
                                            paginatedResults.map((u) => {
                                                const slug = u.username || u.id;
                                                const display = u.name || u.username || 'User';

                                                return (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => setSelectedId(u.id)}
                                                        className={clsx(
                                                            'w-full text-left p-3 hover:bg-gray-50 flex items-start gap-3',
                                                            selectedId === u.id && 'bg-gray-50'
                                                        )}
                                                        title={display}
                                                    >
                                                        {u.image ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={u.image}
                                                                alt={display}
                                                                className="w-10 h-10 rounded-full object-cover border"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-gray-200 border flex items-center justify-center text-xs font-semibold">
                                                                {(u.name || u.username || 'U').slice(0, 2)}
                                                            </div>
                                                        )}

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="min-w-0 flex items-center gap-2">
                                                                    <Link
                                                                        href={`/u/${encodeURIComponent(slug)}`}
                                                                        className="truncate font-medium hover:underline"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        title={display}
                                                                    >
                                                                        {display}
                                                                    </Link>
                                                                    <span className="text-xs text-gray-500">
                                                                        {u.role?.toLowerCase()}
                                                                    </span>
                                                                </div>

                                                                {u.isPrivate && (
                                                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border whitespace-nowrap">
                                                                        private
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                                                {u.about?.trim()
                                                                    ? u.about
                                                                    : `@${u.username || (u.name || '').toLowerCase().replace(/\s+/g, '')}`}
                                                            </div>

                                                            <div className="mt-1 text-[11px] text-gray-500 flex items-center gap-2">
                                                                {(u.city || u.state) && (
                                                                    <span>
                                                                        {u.city}
                                                                        {u.state ? `, ${u.state}` : ''}
                                                                    </span>
                                                                )}
                                                                {u.price != null && (
                                                                    <span>
                                                                        {(u.city || u.state) ? '· ' : ''}
                                                                        {u.role === 'TRAINER'
                                                                            ? `$${u.price}/hr`
                                                                            : u.role === 'GYM'
                                                                                ? `$${u.price}/mo`
                                                                                : `$${u.price}`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                    {allResults.length > 0 && (
                                        <div className="px-4 py-3 border-t flex items-center justify-between text-xs text-gray-600">
                                            <button
                                                className="px-2 py-1 rounded border disabled:opacity-40"
                                                disabled={page === 1}
                                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            >
                                                Previous
                                            </button>
                                            <span>
                                                Page {page} of {totalPages}
                                            </span>
                                            <button
                                                className="px-2 py-1 rounded border disabled:opacity-40"
                                                disabled={page === totalPages}
                                                onClick={() =>
                                                    setPage((p) => Math.min(totalPages, p + 1))
                                                }
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </aside>

                            <section className="flex-1 min-w-0">
                                <div className="bg-white border rounded-xl p-6 min-h-[calc(100vh-190px)]">
                                    {!selected ? (
                                        <div className="text-gray-500">Select a result to see details.</div>
                                    ) : (
                                        <UserDetails
                                            u={selected}
                                            onMessage={handleMessage}
                                            onShare={handleShareProfile}
                                            onOpenImage={(url) => setLightboxUrl(url)}
                                        />
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </main>

            {mounted && lightboxUrl && createPortal(
                <div
                    className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center"
                    onClick={() => setLightboxUrl(null)}
                    aria-modal="true"
                    role="dialog"
                >
                    <div
                        className="bg-white p-6 rounded-xl shadow-lg relative max-w-[90vw] max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setLightboxUrl(null)}
                            className="absolute right-4 top-4 p-1 hover:bg-zinc-100 rounded-full transition"
                            aria-label="Close"
                            type="button"
                            title="Close"
                        >
                            <X size={24} />
                        </button>

                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={lightboxUrl}
                            alt="Preview"
                            className="max-h:[80vh] max-w-[82vw] w-full h-auto object-contain rounded-md"
                        />
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
}


type UserDetailsProps = {
    u: SearchUser;
    onMessage: (u: SearchUser) => void;
    onShare: (u: SearchUser) => void;
    onOpenImage: (url: string) => void;
    variant?: 'desktop' | 'mobile';
};

function UserDetails({ u, onMessage, onShare, onOpenImage, variant = 'desktop' }: UserDetailsProps) {
    const slug = u.username || u.id;
    const display = u.name || u.username || 'User';

    return (
        <div className={clsx("max-w-[820px]", variant === 'mobile' && "max-w-full space-y-4")}>
            {/* Header: name + actions on the RIGHT */}
            <div
                className={clsx(
                    "flex items-start gap-4",
                    variant === 'mobile' && "flex-col gap-3"
                )}
            >
                {u.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.image} alt="" className="w-16 h-16 rounded-full object-cover border shrink-0" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 border flex items-center justify-center text-sm font-semibold">
                        {(u.name || u.username || 'U').slice(0, 2)}
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div
                        className={clsx(
                            "flex items-center justify-between gap-3",
                            variant === 'mobile' && "flex-col items-start gap-2"
                        )}
                    >
                        <div className={clsx("font-semibold min-w-0", variant === 'mobile' ? "text-xl" : "text-2xl")}>
                            <Link
                                href={`/u/${encodeURIComponent(slug)}`}
                                className={clsx(
                                    "hover:underline align-middle",
                                    variant === 'mobile' ? "break-words" : "truncate"
                                )}
                                title={display}
                            >
                                {display}
                            </Link>
                            <span
                                className={clsx(
                                    "text-base text-gray-500",
                                    variant === 'mobile' ? "block mt-1" : "ml-3 align-middle"
                                )}
                            >
                                {u.role?.toLowerCase()}
                            </span>
                        </div>

                        <div
                            className={clsx(
                                "flex items-center gap-2",
                                variant === 'mobile' && "w-full flex-wrap gap-2"
                            )}
                        >
                            <button
                                className="px-3 py-1.5 rounded-full border bg-white text-sm hover:bg-gray-50"
                                title="Message"
                                onClick={() => onMessage(u)}
                            >
                                <span className="inline-flex items-center gap-1">
                                    <MessageSquare size={16} />
                                    Message
                                </span>
                            </button>
                            <button
                                className="px-3 py-1.5 rounded-full border bg-white text-sm hover:bg-gray-50"
                                title="Share profile"
                                onClick={() => onShare(u)}
                            >
                                <span className="inline-flex items-center gap-1">
                                    <Share2 size={16} />
                                    Share
                                </span>
                            </button>

                            {(u.role === 'TRAINER' || u.role === 'GYM') && (
                                <Link
                                    href={`/u/${encodeURIComponent(slug)}?rate=1`}
                                    className="px-3 py-1.5 rounded-full border bg-white text-sm hover:bg-gray-50"
                                    title={`Rate this ${u.role.toLowerCase()}`}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        <Star size={16} />
                                        Rate
                                    </span>
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className={clsx("text-sm text-gray-600 mt-1", variant === 'mobile' && "break-words")}>
                        {u.city}
                        {u.state ? `, ${u.state}` : ''}
                        {u.price != null && (
                            <>
                                {' '}
                                • {u.role === 'TRAINER'
                                    ? `$${u.price}/hr`
                                    : u.role === 'GYM'
                                        ? `$${u.price}/mo`
                                        : `$${u.price}`}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <hr className={clsx("my-5", variant === 'mobile' && "my-4")} />

            {/* About */}
            <div>
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-gray-800 whitespace-pre-wrap break-words">
                    {u.about?.trim() || 'No description provided.'}
                </p>
            </div>

            {/* TRAINEE — Goals on its own line */}
            {u.role === 'TRAINEE' && u.goals && (
                <section className={clsx("mt-6", variant === 'mobile' && "mt-4")}>
                    <h3 className="font-semibold mb-2">Goals</h3>
                    <TagList items={u.goals} />
                </section>
            )}

            {/* TRAINER — Services, Clients, Rating all on the same line */}
            {u.role === 'TRAINER' && (
                <section
                    className={clsx(
                        "mt-6 grid grid-cols-3 gap-4 text-sm items-start",
                        variant === 'mobile' && "grid-cols-1 gap-3"
                    )}
                >
                    <div className="min-w-0">
                        <div className="font-semibold mb-1">Services</div>
                        <TagList items={u.services ?? []} />
                    </div>
                    <div className="min-w-0">
                        <div className="font-semibold mb-1">Clients</div>
                        <div className="text-gray-700">{u.clients ?? 0}</div>
                    </div>
                    <div className="min-w-0">
                        <div className="font-semibold mb-1">Rating</div>
                        <div className="text-gray-700">{u.rating?.toFixed(1) ?? 'N/A'}</div>
                    </div>
                </section>
            )}

            {/* GYM — Amenities on its own line (description preferred) */}
            {u.role === 'GYM' && (
                <section className={clsx("mt-6", variant === 'mobile' && "mt-4")}>
                    <h3 className="font-semibold mb-2">Amenities</h3>
                    {u.amenitiesText?.trim() ? (
                        <p className="text-gray-800 whitespace-pre-wrap">{u.amenitiesText}</p>
                    ) : u.amenities?.length ? (
                        <TagList items={u.amenities} />
                    ) : (
                        <div className="text-gray-600">—</div>
                    )}
                </section>
            )}

            {/* Photos (click to enlarge in modal) — on its own line */}
            {!!u.gallery?.length && (
                <section className={clsx("mt-6", variant === 'mobile' && "mt-4")}>
                    <h3 className="font-semibold mb-2">Photos</h3>
                    <div className={clsx("grid gap-2", variant === 'mobile' ? "grid-cols-2" : "grid-cols-3")}>
                        {u.gallery.map((url) => (
                            <button
                                key={url}
                                type="button"
                                className="group relative aspect-square overflow-hidden rounded-lg border bg-black"
                                onClick={() => onOpenImage(url)}
                                title="View photo"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={url}
                                    alt=""
                                    className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
                                />
                            </button>
                        ))}
                    </div>
                </section>
            )}

        </div>
    );
}

function TagList({ items }: { items: string[] }) {
    if (!items.length) return <div className="text-gray-600">—</div>;
    return (
        <div className="flex flex-wrap gap-1">
            {items.map((x) => (
                <span key={x} className="px-2 py-0.5 rounded-full border text-xs bg-gray-50">
                    {x}
                </span>
            ))}
        </div>
    );
}

function Chip({
    label,
    value,
    menu,
    size = 'default',
    fluid = false,
    showValue = true,
    active = false,
    menuClassName,
    menuPosition,
    menuFixed = false,
}: {
    label: string;
    value: string | number;
    menu: React.ReactNode;
    size?: 'default' | 'compact';
    fluid?: boolean;
    showValue?: boolean;
    active?: boolean;
    menuClassName?: string;
    menuPosition?: string;
    menuFixed?: boolean;
}) {
    const compact = size === 'compact';
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);
    const [menuTop, setMenuTop] = useState<number | null>(null);
    useEffect(() => {
        const handler = (e: CustomEvent<string>) => {
            if (e.detail !== label) {
                setOpen(false);
                setMenuTop(null);
            }
        };
        window.addEventListener('close-filters', handler as EventListener);
        return () => window.removeEventListener('close-filters', handler as EventListener);
    }, [label]);
    const spacingClass = showValue ? (compact ? 'gap-1' : 'gap-2') : 'gap-1.5';
    const justifyClass = showValue ? '' : 'justify-between';

    return (
        <div ref={wrapperRef} className={clsx('relative', fluid && 'w-full')}>
            <button
                onClick={() => {
                    const next = !open;
                    setOpen(next);
                    if (next) {
                        window.dispatchEvent(new CustomEvent('close-filters', { detail: label }));
                        if (menuFixed) {
                            const rect = wrapperRef.current?.getBoundingClientRect();
                            setMenuTop((rect?.bottom ?? 0) + 8);
                        }
                    } else {
                        setMenuTop(null);
                    }
                }}
                className={clsx(
                    'flex items-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
                    fluid ? 'w-full' : 'max-w-[220px]',
                    compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-sm',
                    spacingClass,
                    justifyClass,
                    active
                        ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100'
                        : 'border-gray-200 bg-white/80 text-gray-700 hover:border-gray-400 hover:bg-white'
                )}
            >
                <span
                    className={clsx(
                        'whitespace-nowrap uppercase tracking-wide',
                        compact ? 'text-[10px]' : 'text-xs',
                        active ? 'text-green-700' : 'text-gray-500',
                        !showValue && 'flex-1 text-left'
                )}
            >
                {label}
                </span>
                {showValue && (
                    <>
                        <span
                            className={clsx(
                                active ? 'bg-green-200' : 'bg-gray-200',
                                compact ? 'h-3 w-px' : 'h-4 w-px'
                            )}
                            aria-hidden="true"
                        />
                        <span className={clsx('truncate', fluid ? 'flex-1 text-right' : 'max-w-[120px]')}>
                            {value}
                        </span>
                    </>
                )}
                <ChevronDown
                    size={compact ? 14 : 16}
                    className={clsx('shrink-0', active ? 'text-green-700' : 'text-gray-500')}
                />
            </button>
            {open && (
                <>
                    {menuFixed && (
                        <div
                            className="fixed inset-0 z-30 bg-black/10"
                            onClick={() => {
                                setOpen(false);
                                setMenuTop(null);
                            }}
                        />
                    )}
                    <div
                        className={clsx(
                            menuFixed
                                ? 'fixed left-1/2 z-40 -translate-x-1/2 rounded-2xl border border-gray-200 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur w-[calc(100vw-32px)] max-w-sm'
                                : 'absolute z-20 mt-2 rounded-2xl border border-gray-200 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur',
                            menuFixed ? '' : menuPosition ?? 'right-0',
                            menuClassName ?? (menuFixed ? '' : 'min-w-[240px]')
                        )}
                        style={
                            menuFixed
                                ? { top: menuTop ?? (wrapperRef.current?.getBoundingClientRect().bottom ?? 0) + 8 }
                                : undefined
                        }
                    >
                        <div className="flex justify-end px-2 pt-2">
                            <button
                                onClick={() => {
                                    setOpen(false);
                                    setMenuTop(null);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition"
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="px-4 pb-4">
                            {menu}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
