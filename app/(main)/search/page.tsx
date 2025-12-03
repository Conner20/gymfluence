'use client';

import { useEffect, useMemo, useState } from 'react';
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
        <div className="px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 rounded-full border px-3 py-2">
                <SearchIcon size={18} className="text-gray-500" />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="flex-1 outline-none text-sm"
                    placeholder="Search by name or @username…"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                <Chip
                    label="Distance"
                    value={distanceKm ? `${distanceKm} km` : 'Any'}
                    menu={
                        <div className="grid grid-cols-2 gap-2 p-2 w-52">
                            {['', '5', '10', '25', '50', '100'].map((d) => (
                                <button
                                    key={d || 'any'}
                                    onClick={() => setDistanceKm(d)}
                                    className={clsx(
                                        'w-full px-2 py-1 rounded border text-sm text-left whitespace-normal break-words',
                                        (distanceKm || '') === d ? 'bg-gray-900 text-white' : 'bg-white'
                                    )}
                                >
                                    {d ? `${d} km` : 'Any'}
                                </button>
                            ))}
                        </div>
                    }
                />
                <Chip
                    label="Role"
                    value={role === 'ALL' ? 'All' : role.toLowerCase()}
                    menu={
                        <div className="grid grid-cols-2 gap-2 p-2 w-52">
                            {(['ALL', 'TRAINEE', 'TRAINER', 'GYM'] as const).map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRole(r)}
                                    className={clsx(
                                        'w-full px-2 py-1 rounded border text-sm text-left whitespace-normal break-words',
                                        role === r ? 'bg-gray-900 text-white' : 'bg-white'
                                    )}
                                >
                                    {r.toLowerCase()}
                                </button>
                            ))}
                        </div>
                    }
                />
                <Chip
                    label="Budget"
                    value={`${minBudget || 0}–${maxBudget || '∞'}`}
                    menu={
                        <div className="p-3 w-72">
                            <div className="text-xs text-gray-500 mb-2">
                                Trainers: hourly • Gyms: monthly fee
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    className="w-28 border rounded px-2 py-1 text-sm"
                                    placeholder="min"
                                    value={minBudget}
                                    onChange={(e) => setMinBudget(e.target.value)}
                                />
                                <span className="text-gray-400">—</span>
                                <input
                                    type="number"
                                    min={0}
                                    className="w-28 border rounded px-2 py-1 text-sm"
                                    placeholder="max"
                                    value={maxBudget}
                                    onChange={(e) => setMaxBudget(e.target.value)}
                                />
                            </div>
                            <div className="mt-3 flex justify-end">
                                <button
                                    onClick={() => {
                                        setMinBudget('');
                                        setMaxBudget('');
                                    }}
                                    className="text-xs text-gray-600 underline"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    }
                />
                <Chip
                    label="Goals"
                    value={goals.length ? `${goals.length} selected` : 'Any'}
                    menu={
                        <div className="p-3 grid grid-cols-1 gap-1 w-[260px]">
                            {allGoals.map((g) => (
                                <label key={g} className="text-sm flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={goals.includes(g)}
                                        onChange={() => toggleGoal(g)}
                                    />
                                    <span>{g}</span>
                                </label>
                            ))}
                            <div className="flex justify-end mt-1">
                                <button onClick={() => setGoals([])} className="text-xs text-gray-600 underline">
                                    Clear
                                </button>
                            </div>
                        </div>
                    }
                />
                <button
                    onClick={resetFilters}
                    className="text-sm px-3 py-2 rounded-full border bg-white hover:bg-gray-50"
                    title="Reset filters"
                >
                    Reset
                </button>
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
                    "w-full rounded-2xl border bg-white px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 shadow-sm",
                    isSelected && "ring-2 ring-gray-900"
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

    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col overflow-x-hidden">
            <MobileHeader title="search" href="/search" subContent={mobileFilters} />

            {/* Desktop header */}
            <header className="hidden lg:block sticky top-0 z-20 w-full bg-white border-b">
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
                            menu={
                                <div className="grid grid-cols-2 gap-2 p-2 w-52">
                                    {['', '5', '10', '25', '50', '100'].map((d) => (
                                        <button
                                            key={d || 'any'}
                                            onClick={() => setDistanceKm(d)}
                                            className={clsx(
                                                'w-full px-2 py-1 rounded border text-sm text-left whitespace-normal break-words',
                                                (distanceKm || '') === d ? 'bg-gray-900 text-white' : 'bg-white'
                                            )}
                                        >
                                            {d ? `${d} km` : 'Any'}
                                        </button>
                                    ))}
                                </div>
                            }
                        />

                        <Chip
                            label="Role"
                            value={role === 'ALL' ? 'All' : role.toLowerCase()}
                            menu={
                                <div className="grid grid-cols-2 gap-2 p-2 w-52">
                                    {(['ALL', 'TRAINEE', 'TRAINER', 'GYM'] as const).map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setRole(r)}
                                            className={clsx(
                                                'w-full px-2 py-1 rounded border text-sm text-left whitespace-normal break-words',
                                                role === r ? 'bg-gray-900 text-white' : 'bg-white'
                                            )}
                                        >
                                            {r.toLowerCase()}
                                        </button>
                                    ))}
                                </div>
                            }
                        />


                        <Chip
                            label="Budget"
                            value={`${minBudget || 0}–${maxBudget || '∞'}`}
                            menu={
                                <div className="p-3 w-72">
                                    <div className="text-xs text-gray-500 mb-2">
                                        Trainers: hourly • Gyms: monthly fee
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            className="w-28 border rounded px-2 py-1 text-sm"
                                            placeholder="min"
                                            value={minBudget}
                                            onChange={(e) => setMinBudget(e.target.value)}
                                        />
                                        <span className="text-gray-400">—</span>
                                        <input
                                            type="number"
                                            min={0}
                                            className="w-28 border rounded px-2 py-1 text-sm"
                                            placeholder="max"
                                            value={maxBudget}
                                            onChange={(e) => setMaxBudget(e.target.value)}
                                        />
                                    </div>
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            onClick={() => {
                                                setMinBudget('');
                                                setMaxBudget('');
                                            }}
                                            className="text-xs text-gray-600 underline"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            }
                        />

                        <Chip
                            label="Goals"
                            value={goals.length ? `${goals.length} selected` : 'Any'}
                            menu={
                                <div className="p-3 grid grid-cols-1 gap-1 w-[260px]">
                                    {allGoals.map((g) => (
                                        <label key={g} className="text-sm flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={goals.includes(g)}
                                                onChange={() => toggleGoal(g)}
                                            />
                                            <span>{g}</span>
                                        </label>
                                    ))}
                                    <div className="flex justify-end mt-1">
                                        <button onClick={() => setGoals([])} className="text-xs text-gray-600 underline">
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            }
                        />

                        <button
                            onClick={resetFilters}
                            className="text-sm px-3 py-2 rounded-full border bg-white hover:bg-gray-50"
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
                            ) : data?.results.length ? (
                                <div className="space-y-3">
                                    {data.results.map((u) => renderMobileCard(u))}
                                </div>
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
                            <div className="bg-white border rounded-xl p-4">
                                {!selected ? (
                                    <div className="text-gray-500 text-sm">Select a result to see details.</div>
                                ) : (
                                    <UserDetails
                                        u={selected}
                                        onMessage={handleMessage}
                                        onShare={handleShareProfile}
                                        onOpenImage={(url) => setLightboxUrl(url)}
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
                                <div className="bg-white border rounded-xl overflow-hidden">
                                    <div className="h-[calc(100vh-190px)] overflow-y-auto divide-y">
                                        {loading ? (
                                            <div className="p-4 text-sm text-gray-500">Loading…</div>
                                        ) : error ? (
                                            <div className="p-4 text-sm text-red-500">{error}</div>
                                        ) : !data || data.results.length === 0 ? (
                                            <div className="p-4 text-sm text-gray-500">No results.</div>
                                        ) : (
                                            data.results.map((u) => {
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


function UserDetails({
    u,
    onMessage,
    onShare,
    onOpenImage,
}: {
    u: SearchUser;
    onMessage: (u: SearchUser) => void;
    onShare: (u: SearchUser) => void;
    onOpenImage: (url: string) => void;
}) {
    const slug = u.username || u.id;
    const display = u.name || u.username || 'User';

    return (
        <div className="max-w-[820px]">
            {/* Header: name + actions on the RIGHT */}
            <div className="flex items-start gap-4">
                {u.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.image} alt="" className="w-16 h-16 rounded-full object-cover border" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 border flex items-center justify-center text-sm font-semibold">
                        {(u.name || u.username || 'U').slice(0, 2)}
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-2xl font-semibold min-w-0">
                            <Link
                                href={`/u/${encodeURIComponent(slug)}`}
                                className="hover:underline truncate align-middle"
                                title={display}
                            >
                                {display}
                            </Link>
                            <span className="ml-3 text-base text-gray-500 align-middle">{u.role?.toLowerCase()}</span>
                        </div>

                        <div className="flex items-center gap-2">
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

                    {/* UPDATED: only city, state + rate/fee; no country, no km away */}
                    <div className="text-sm text-gray-600 mt-1">
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

            <hr className="my-5" />

            {/* About */}
            <div>
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-gray-800 whitespace-pre-wrap">
                    {u.about?.trim() || 'No description provided.'}
                </p>
            </div>

            {/* TRAINEE — Goals on its own line */}
            {u.role === 'TRAINEE' && u.goals && (
                <section className="mt-6">
                    <h3 className="font-semibold mb-2">Goals</h3>
                    <TagList items={u.goals} />
                </section>
            )}

            {/* TRAINER — Services, Clients, Rating all on the same line */}
            {u.role === 'TRAINER' && (
                <section className="mt-6 grid grid-cols-3 gap-4 text-sm items-start">
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
                <section className="mt-6">
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
                <section className="mt-6">
                    <h3 className="font-semibold mb-2">Photos</h3>
                    <div className="grid grid-cols-3 gap-2">
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
}: {
    label: string;
    value: string | number;
    menu: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 px-3 py-2 rounded-full border bg-white hover:bg-gray-50 text-sm max-w-[220px]"
            >
                <span className="whitespace-nowrap">{label}</span>
                <span className="px-1 text-gray-500">•</span>
                <span className="text-gray-700 truncate max-w-[120px]">
                    {value}
                </span>
                <ChevronDown size={16} className="ml-1 text-gray-500 shrink-0" />
            </button>
            {open && (
                <div className="absolute right-0 mt-2 bg-white border rounded-xl shadow-lg">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setOpen(false)}
                            className="p-2 text-gray-500 hover:text-black"
                            title="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    {menu}
                </div>
            )}
        </div>
    );
}
