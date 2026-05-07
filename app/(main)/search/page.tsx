'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, ChevronDown, X, MessageSquare, Share2, Star } from 'lucide-react';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import MobileHeader from "@/components/MobileHeader";
import { GymDiscoveryPanel } from "@/components/GymMapPage";

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
    hiringTrainers?: boolean;

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

type StatusFilter = 'ALL' | 'LOOKING_GYM' | 'LOOKING_TRAINER' | 'AT_GYM';
type ViewerCoords = { lat: number; lng: number };
type SortBy = 'DISTANCE' | 'RATING';

const traineeStatusOptions = [
    ['ALL', 'Any'],
    ['LOOKING_GYM', 'Looking for a gym'],
    ['LOOKING_TRAINER', 'Looking for a trainer'],
] as const;

const trainerStatusOptions = [
    ['ALL', 'Any'],
    ['LOOKING_GYM', 'Looking for a gym'],
    ['AT_GYM', 'Training at a gym'],
] as const;

const generalStatusOptions = [
    ['ALL', 'Any'],
    ['LOOKING_GYM', 'Looking for a gym'],
    ['LOOKING_TRAINER', 'Looking for a trainer'],
    ['AT_GYM', 'Training at a gym'],
] as const;

function getStatusLabel(role: 'ALL' | Role, statusFilter: StatusFilter) {
    if (statusFilter === 'LOOKING_GYM') return 'Looking for a gym';
    if (statusFilter === 'LOOKING_TRAINER') return 'Looking for a trainer';
    if (statusFilter === 'AT_GYM') return 'Training at a gym';
    return 'Any';
}

function formatDistanceMiles(distanceKm: number) {
    const miles = distanceKm * 0.621371;
    if (miles < 10) return `${miles.toFixed(1)} mi`;
    return `${Math.round(miles)} mi`;
}

export default function SearchPage() {
    const router = useRouter();

    // ------- filters -------
    const [q, setQ] = useState('');
    const [role, setRole] = useState<'ALL' | Role>('ALL');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [minBudget, setMinBudget] = useState('');
    const [maxBudget, setMaxBudget] = useState('');
    const [goals, setGoals] = useState<string[]>([]);
    const [hiringOnly, setHiringOnly] = useState(false);
    const [gymSortBy, setGymSortBy] = useState<SortBy>('DISTANCE');
    const [trainerSortBy, setTrainerSortBy] = useState<SortBy>('DISTANCE');

    // data
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ApiResponse | null>(null);
    const [viewerCoords, setViewerCoords] = useState<ViewerCoords | null>(null);
    const [mobileView, setMobileView] = useState<'list' | 'details'>('list');
    const pageSize = 10;
    const [page, setPage] = useState(1);
    const listRef = useRef<HTMLDivElement | null>(null);
    const mobileListRef = useRef<HTMLDivElement | null>(null);
    const previousRoleRef = useRef<'ALL' | Role>('ALL');

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
    const [isDesktopViewport, setIsDesktopViewport] = useState(false);
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const updateViewport = () => {
            setIsDesktopViewport(window.innerWidth >= 1024);
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

        let cancelled = false;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (cancelled) return;
                setViewerCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            () => {
                // Fallback to server-side stored profile coordinates when unavailable.
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5 * 60 * 1000,
            }
        );

        return () => {
            cancelled = true;
        };
    }, []);

    const fetchResults = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (q.trim()) params.set('q', q.trim());
            if (role !== 'ALL') params.set('role', role);
            if (role !== 'GYM' && statusFilter !== 'ALL') params.set('status', statusFilter);
            if (role !== 'TRAINEE' && minBudget) params.set('minBudget', minBudget);
            if (role !== 'TRAINEE' && maxBudget) params.set('maxBudget', maxBudget);
            if (goals.length) params.set('goals', goals.join(','));
            if (role === 'GYM' && hiringOnly) params.set('hiringOnly', 'true');
            if (role === 'GYM' && gymSortBy === 'RATING') params.set('sortBy', 'RATING');
            if (role === 'TRAINER' && trainerSortBy === 'RATING') params.set('sortBy', 'RATING');
            if (viewerCoords) {
                params.set('viewerLat', String(viewerCoords.lat));
                params.set('viewerLng', String(viewerCoords.lng));
            }
            params.set('page', '1');
            params.set('pageSize', '1000');

            const res = await fetch(`/api/search?${params.toString()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const json: ApiResponse = await res.json();
            const filteredResults = json.results.filter((user) => Boolean(user.role));
            setData({
                ...json,
                results: filteredResults,
                total: filteredResults.length,
            });
            setPage(1);

            setSelectedId((prev) =>
                prev && filteredResults.some((r) => r.id === prev) ? prev : filteredResults[0]?.id ?? null
            );
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
    }, [q, role, statusFilter, minBudget, maxBudget, goals, viewerCoords, hiringOnly, gymSortBy, trainerSortBy]);

    const resetFilters = () => {
        setQ('');
        setRole('ALL');
        setStatusFilter('ALL');
        setMinBudget('');
        setMaxBudget('');
        setGoals([]);
        setHiringOnly(false);
        setGymSortBy('DISTANCE');
        setTrainerSortBy('DISTANCE');
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
        if (role !== 'GYM') {
            setHiringOnly(false);
            setGymSortBy('DISTANCE');
        }
        if (role !== 'TRAINER') {
            setTrainerSortBy('DISTANCE');
        }
        if (role === 'TRAINEE' && (minBudget || maxBudget)) {
            setMinBudget('');
            setMaxBudget('');
        }
        if (role === 'GYM' && statusFilter !== 'ALL') {
            setStatusFilter('ALL');
        }
        if (role === 'TRAINER' && statusFilter === 'LOOKING_TRAINER') {
            setStatusFilter('ALL');
        }
        if (role === 'TRAINEE' && statusFilter === 'AT_GYM') {
            setStatusFilter('ALL');
        }
    }, [role, statusFilter]);

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

    useEffect(() => {
        if (isDesktopViewport) {
            previousRoleRef.current = role;
            return;
        }

        if (previousRoleRef.current !== role && mobileView === 'details') {
            setMobileView('list');
        }

        previousRoleRef.current = role;
    }, [isDesktopViewport, mobileView, role]);

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
        <div className="px-4 py-4 space-y-2 bg-white dark:bg-neutral-900">
            <div className="flex items-center gap-2 rounded-full border px-3 py-2 dark:border-white/15">
                <SearchIcon size={18} className="text-gray-500 dark:text-gray-400" />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="flex-1 outline-none text-sm bg-transparent dark:text-white"
                    placeholder="Search by name or @username…"
                />
            </div>
            <div className={clsx('grid gap-1.5', role === 'TRAINER' ? 'grid-cols-5' : role === 'TRAINEE' ? 'grid-cols-3' : 'grid-cols-4')}>
                {role === 'GYM' ? (
                    <>
                <div className="min-w-0">
                    <Chip
                        label="Role"
                        value="gym"
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
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
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
                        active
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                    />
                </div>
                <div className="min-w-0">
                    <ToggleChip
                        label="Hiring"
                        active={hiringOnly}
                        onClick={() => setHiringOnly((current) => !current)}
                        size="compact"
                        fluid
                    />
                </div>
                <div className="min-w-0">
                    <Chip
                        label="Price"
                        value={`${minBudget || 0}–${maxBudget || '∞'}`}
                        menu={
                            <div className="space-y-2.5 p-3 text-sm">
                                <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-400">
                                    gyms monthly
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-20 flex-1 rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                        placeholder="Min"
                                        value={minBudget}
                                        onChange={(e) => setMinBudget(e.target.value)}
                                    />
                                    <span className="text-gray-400 dark:text-gray-500">—</span>
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-20 flex-1 rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                        placeholder="Max"
                                        value={maxBudget}
                                        onChange={(e) => setMaxBudget(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <button
                                        onClick={() => {
                                            setMinBudget('');
                                            setMaxBudget('');
                                        }}
                                        className="rounded-full px-2 py-1 transition hover:text-gray-800 dark:hover:text-white"
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
                <div className="min-w-0">
                    <ToggleChip
                        label="Rating"
                        active={gymSortBy === 'RATING'}
                        onClick={() => setGymSortBy((current) => (current === 'RATING' ? 'DISTANCE' : 'RATING'))}
                        size="compact"
                        fluid
                    />
                </div>
                    </>
                ) : role === 'TRAINER' ? (
                    <>
                <div className="min-w-0">
                    <Chip
                        label="Role"
                        value="trainer"
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
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
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
                        active
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                        hideChevron
                        centerLabel
                    />
                </div>
                <div className="min-w-0">
                    <Chip
                        label="Price"
                        value={`${minBudget || 0}–${maxBudget || '∞'}`}
                        menu={
                            <div className="space-y-2.5 p-3 text-sm">
                                <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-400">
                                    trainers hourly
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-20 flex-1 rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                        placeholder="Min"
                                        value={minBudget}
                                        onChange={(e) => setMinBudget(e.target.value)}
                                    />
                                    <span className="text-gray-400 dark:text-gray-500">—</span>
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-20 flex-1 rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                        placeholder="Max"
                                        value={maxBudget}
                                        onChange={(e) => setMaxBudget(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <button
                                        onClick={() => {
                                            setMinBudget('');
                                            setMaxBudget('');
                                        }}
                                        className="rounded-full px-2 py-1 transition hover:text-gray-800 dark:hover:text-white"
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
                        hideChevron
                        centerLabel
                    />
                </div>
                <div className="min-w-0">
                    <ToggleChip
                        label="Rating"
                        active={trainerSortBy === 'RATING'}
                        onClick={() => setTrainerSortBy((current) => (current === 'RATING' ? 'DISTANCE' : 'RATING'))}
                        size="compact"
                        fluid
                    />
                </div>
                <div className="min-w-0">
                    <Chip
                        label="Service"
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
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleGoal(g)}
                                                className="accent-gray-900 dark:accent-green-400"
                                            />
                                            <span>{g}</span>
                                        </label>
                                    );
                                })}
                                <button
                                    onClick={() => setGoals([])}
                                    className="mt-2 text-right text-xs text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                                >
                                    Clear services
                                </button>
                            </div>
                        }
                        size="compact"
                        fluid
                        showValue={false}
                        active={goals.length > 0}
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                        hideChevron
                        centerLabel
                    />
                </div>
                <div className="min-w-0">
                    <Chip
                        label="Status"
                        value={getStatusLabel(role, statusFilter)}
                        menu={
                            <div className="flex flex-col gap-1 p-3">
                                {trainerStatusOptions.map(([value, label]) => {
                                    const activeOpt = statusFilter === value;
                                    return (
                                        <button
                                            key={value}
                                            onClick={() => setStatusFilter(value)}
                                            className={clsx(
                                                'rounded-2xl border px-3 py-2 text-left text-sm transition',
                                                activeOpt
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                            )}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        }
                        size="compact"
                        fluid
                        showValue={false}
                        active={statusFilter !== 'ALL'}
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                        hideChevron
                        centerLabel
                    />
                </div>
                    </>
                ) : role === 'TRAINEE' ? (
                    <>
                <div className="min-w-0">
                    <Chip
                        label="Role"
                        value="trainee"
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
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
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
                        active
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                    />
                </div>
                <div className="min-w-0">
                    <Chip
                        label="Status"
                        value={getStatusLabel(role, statusFilter)}
                        menu={
                            <div className="flex flex-col gap-1 p-3">
                                {traineeStatusOptions.map(([value, label]) => {
                                    const activeOpt = statusFilter === value;
                                    return (
                                        <button
                                            key={value}
                                            onClick={() => setStatusFilter(value)}
                                            className={clsx(
                                                'rounded-2xl border px-3 py-2 text-left text-sm transition',
                                                activeOpt
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                            )}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        }
                        size="compact"
                        fluid
                        showValue={false}
                        active={statusFilter !== 'ALL'}
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                    />
                </div>
                <div className="min-w-0">
                    <Chip
                        label="Goal"
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
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleGoal(g)}
                                                className="accent-gray-900 dark:accent-green-400"
                                            />
                                            <span>{g}</span>
                                        </label>
                                    );
                                })}
                                <button
                                    onClick={() => setGoals([])}
                                    className="mt-2 text-right text-xs text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
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
                    </>
                ) : (
                    <>
                <div className="min-w-0">
                    <Chip
                        label="Role"
                        value="All"
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
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
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
                <div className="min-w-0">
                    <Chip
                        label="Status"
                        value={getStatusLabel(role, statusFilter)}
                        menu={
                            <div className="flex flex-col gap-1 p-3">
                                {generalStatusOptions.map(([value, label]) => {
                                    const activeOpt = statusFilter === value;
                                    return (
                                        <button
                                            key={value}
                                            onClick={() => setStatusFilter(value)}
                                            className={clsx(
                                                'rounded-2xl border px-3 py-2 text-left text-sm transition',
                                                activeOpt
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                            )}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        }
                        size="compact"
                        fluid
                        showValue={false}
                        active={statusFilter !== 'ALL'}
                        menuClassName="max-h-[60vh] overflow-y-auto"
                        menuFixed
                    />
                </div>
                <div className="min-w-0">
                    <Chip
                        label="Price"
                        value={`${minBudget || 0}–${maxBudget || '∞'}`}
                            menu={
                                <div className="space-y-2.5 p-3 text-sm">
                                <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-400">
                                    trainers hourly · gyms monthly
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-20 flex-1 rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                        placeholder="Min"
                                        value={minBudget}
                                        onChange={(e) => setMinBudget(e.target.value)}
                                    />
                                    <span className="text-gray-400 dark:text-gray-500">—</span>
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-20 flex-1 rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                        placeholder="Max"
                                        value={maxBudget}
                                        onChange={(e) => setMaxBudget(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <button
                                        onClick={() => {
                                            setMinBudget('');
                                            setMaxBudget('');
                                        }}
                                        className="rounded-full px-2 py-1 transition hover:text-gray-800 dark:hover:text-white"
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
                <div className="min-w-0">
                    <Chip
                        label="Goal"
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
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleGoal(g)}
                                                className="accent-gray-900 dark:accent-green-400"
                                            />
                                            <span>{g}</span>
                                        </label>
                                    );
                                })}
                                    <button
                                        onClick={() => setGoals([])}
                                        className="mt-2 text-right text-xs text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
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
                    </>
                )}
                </div>
        </div>
    );

    const handleMobileSelect = (userId: string) => {
        setSelectedId(userId);
        setMobileView('details');
    };

    const renderMobileCard = (u: SearchUser) => {
        const isSelected = selectedId === u.id;
        const display = u.name || u.username || 'User';
        const locationLabel = [u.city, u.state].filter(Boolean).join(', ');
        return (
            <button
                key={`mobile-${u.id}`}
                className={clsx(
                    "w-full rounded-2xl border bg-white px-4 py-3 text-left transition focus-visible:outline-none shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100",
                    isSelected && "border-2 border-gray-900 dark:border-green-400"
                )}
                onClick={() => handleMobileSelect(u.id)}
            >
                <div className="flex items-start gap-3">
                    {u.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.image} alt={display} className="h-11 w-11 rounded-full object-cover border dark:border-white/20" />
                    ) : (
                        <div className="h-11 w-11 rounded-full bg-gray-100 border flex items-center justify-center text-sm font-semibold dark:bg-white/10 dark:border-white/20">
                            {(u.username || u.name || 'U').slice(0, 2).toUpperCase()}
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold leading-tight">
                                    {display}
                                </div>
                                {u.role && (
                                    <div className="mt-1 text-xs capitalize text-gray-500 dark:text-gray-400">
                                        {u.role.toLowerCase()}
                                    </div>
                                )}
                                {locationLabel && (
                                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                        {locationLabel}
                                    </div>
                                )}
                            </div>
                            {typeof u.distanceKm === 'number' && (
                                <div className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                    {formatDistanceMiles(u.distanceKm)}
                                </div>
                            )}
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
    const gymDiscoveryMode = role === 'GYM';
    const minBudgetValue = minBudget.trim() === '' ? null : Number(minBudget);
    const maxBudgetValue = maxBudget.trim() === '' ? null : Number(maxBudget);
    const selectedGymInAnyRole = role === 'ALL' && selected?.role === 'GYM' ? selected : null;

    useEffect(() => {
        if (isDesktopViewport) return;
        if (role !== 'GYM' && role !== 'TRAINER' && role !== 'TRAINEE') return;
        if (mobileView !== 'details') return;
        if (selected) return;
        setMobileView('list');
    }, [isDesktopViewport, mobileView, role, selected]);

    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col overflow-x-hidden dark:bg-[#050505] dark:text-white">
            <MobileHeader title="search" href="/search" subContent={mobileFilters} />

            {/* Desktop header */}
            <header className="hidden lg:block sticky top-0 z-20 w-full bg-white dark:bg-neutral-900 dark:border-b dark:border-white/10">
                <div className="mx-auto max-w-[1400px] w-full flex items-center gap-4 py-6 pl-[40px] pr-4">
                    <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none dark:text-green-400">
                        <span>search</span>
                    </h1>

                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex min-w-[220px] max-w-[520px] flex-1 items-center gap-2 rounded-full border px-3 py-2 dark:border-white/15">
                            <SearchIcon size={18} className="text-gray-500 dark:text-gray-400" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                className="flex-1 outline-none text-sm bg-transparent dark:text-white"
                                placeholder="Search by name or @username…"
                            />
                        </div>

                        <div className="ml-auto flex items-center gap-3">
                        {role === 'GYM' ? (
                            <>
                                <Chip
                                    label="Role"
                                    value="gym"
                                    active
                                    menu={
                                        <div className="flex flex-col gap-1 p-2.5 w-52">
                                            {(['ALL', 'TRAINEE', 'TRAINER', 'GYM'] as const).map((r) => {
                                                const activeOpt = role === r;
                                                return (
                                                    <button
                                                        key={r}
                                                        onClick={() => setRole(r)}
                                                        className={clsx(
                                                            'rounded-2xl border px-3 py-2 text-sm text-left transition capitalize',
                                                            activeOpt
                                                                ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                                : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                                        )}
                                                    >
                                                        {r === 'ALL' ? 'any role' : r.toLowerCase()}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    }
                                />

                                <ToggleChip
                                    label="Hiring"
                                    active={hiringOnly}
                                    onClick={() => setHiringOnly((current) => !current)}
                                />

                                <Chip
                                    label="Budget"
                                    value={`${minBudget || 0}–${maxBudget || '∞'}`}
                                    active={Boolean(minBudget || maxBudget)}
                                    menu={
                                        <div className="space-y-2.5 p-3 w-[19rem] max-w-[calc(100vw-88px)] text-sm">
                                            <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-400">
                                                gyms monthly
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="flex-1 min-w-[92px] rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                                    placeholder="Min"
                                                    value={minBudget}
                                                    onChange={(e) => setMinBudget(e.target.value)}
                                                />
                                                <span className="text-gray-400 dark:text-gray-500">—</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="flex-1 min-w-[92px] rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                                    placeholder="Max"
                                                    value={maxBudget}
                                                    onChange={(e) => setMaxBudget(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                                <button
                                                    onClick={() => {
                                                        setMinBudget('');
                                                        setMaxBudget('');
                                                    }}
                                                    className="rounded-full px-2 py-1 transition hover:text-gray-800 dark:hover:text-white"
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

                                <ToggleChip
                                    label="Rating"
                                    active={gymSortBy === 'RATING'}
                                    onClick={() => setGymSortBy((current) => (current === 'RATING' ? 'DISTANCE' : 'RATING'))}
                                />
                            </>
                        ) : role === 'TRAINER' ? (
                            <>
                        <Chip
                            label="Role"
                            value="trainer"
                            active
                            menu={
                                <div className="flex flex-col gap-1 p-2.5 w-52">
                                    {(['ALL', 'TRAINEE', 'TRAINER', 'GYM'] as const).map((r) => {
                                        const activeOpt = role === r;
                                        return (
                                            <button
                                                key={r}
                                                onClick={() => setRole(r)}
                                                className={clsx(
                                                    'rounded-2xl border px-3 py-2 text-sm text-left transition capitalize',
                                                    activeOpt
                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
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
                                <div className="space-y-2.5 p-3 w-[19rem] max-w-[calc(100vw-88px)] text-sm">
                                    <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-400">
                                        trainers hourly
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            className="flex-1 min-w-[92px] rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                            placeholder="Min"
                                            value={minBudget}
                                            onChange={(e) => setMinBudget(e.target.value)}
                                        />
                                        <span className="text-gray-400 dark:text-gray-500">—</span>
                                        <input
                                            type="number"
                                            min={0}
                                            className="flex-1 min-w-[92px] rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                            placeholder="Max"
                                            value={maxBudget}
                                            onChange={(e) => setMaxBudget(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <button
                                            onClick={() => {
                                                setMinBudget('');
                                                setMaxBudget('');
                                            }}
                                            className="rounded-full px-2 py-1 transition hover:text-gray-800 dark:hover:text-white"
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

                        <ToggleChip
                            label="Rating"
                            active={trainerSortBy === 'RATING'}
                            onClick={() => setTrainerSortBy((current) => (current === 'RATING' ? 'DISTANCE' : 'RATING'))}
                        />

                        <Chip
                            label="Services"
                            value={goals.length ? `${goals.length} selected` : 'Any'}
                            active={goals.length > 0}
                            menu={
                                <div className="flex w-56 flex-col gap-1 p-2.5 text-sm">
                                    {allGoals.map((g) => {
                                        const checked = goals.includes(g);
                                        return (
                                            <label
                                                key={g}
                                                className={clsx(
                                                    'flex items-center gap-2 rounded-2xl border px-3 py-2 transition capitalize',
                                                    checked
                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleGoal(g)}
                                                    className="accent-gray-900 dark:accent-green-400"
                                                />
                                                <span>{g}</span>
                                            </label>
                                        );
                                    })}
                                    <button
                                        onClick={() => setGoals([])}
                                        className="mt-2 text-right text-xs text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                                    >
                                        Clear services
                                    </button>
                                </div>
                            }
                        />

                        <Chip
                            label="Status"
                            value={getStatusLabel(role, statusFilter)}
                            active={statusFilter !== 'ALL'}
                            menu={
                                <div className="flex flex-col gap-1 p-2.5 w-52">
                                    {trainerStatusOptions.map(([value, label]) => {
                                        const activeOpt = statusFilter === value;
                                        return (
                                            <button
                                                key={value}
                                                onClick={() => setStatusFilter(value)}
                                                className={clsx(
                                                    'rounded-2xl border px-3 py-2 text-left text-sm transition',
                                                    activeOpt
                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                                )}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            }
                        />
                            </>
                        ) : role === 'TRAINEE' ? (
                            <>
                        <Chip
                            label="Role"
                            value="trainee"
                            active
                            menu={
                                <div className="flex flex-col gap-1 p-2.5 w-52">
                                    {(['ALL', 'TRAINEE', 'TRAINER', 'GYM'] as const).map((r) => {
                                        const activeOpt = role === r;
                                        return (
                                            <button
                                                key={r}
                                                onClick={() => setRole(r)}
                                                className={clsx(
                                                    'rounded-2xl border px-3 py-2 text-sm text-left transition capitalize',
                                                    activeOpt
                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
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
                            label="Status"
                            value={getStatusLabel(role, statusFilter)}
                            active={statusFilter !== 'ALL'}
                            menu={
                                <div className="flex flex-col gap-1 p-2.5 w-52">
                                    {traineeStatusOptions.map(([value, label]) => {
                                        const activeOpt = statusFilter === value;
                                        return (
                                            <button
                                                key={value}
                                                onClick={() => setStatusFilter(value)}
                                                className={clsx(
                                                    'rounded-2xl border px-3 py-2 text-left text-sm transition',
                                                    activeOpt
                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                                )}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            }
                        />

                        <Chip
                            label="Goals"
                            value={goals.length ? `${goals.length} selected` : 'Any'}
                            active={goals.length > 0}
                            menu={
                                <div className="flex w-56 flex-col gap-1 p-2.5 text-sm">
                                    {allGoals.map((g) => {
                                        const checked = goals.includes(g);
                                        return (
                                            <label
                                                key={g}
                                                className={clsx(
                                                    'flex items-center gap-2 rounded-2xl border px-3 py-2 transition capitalize',
                                                    checked
                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleGoal(g)}
                                                    className="accent-gray-900 dark:accent-green-400"
                                                />
                                                <span>{g}</span>
                                            </label>
                                        );
                                    })}
                                    <button
                                        onClick={() => setGoals([])}
                                        className="mt-2 text-right text-xs text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                                    >
                                        Clear goals
                                    </button>
                                </div>
                            }
                        />
                            </>
                        ) : (
                            <>
                        <Chip
                            label="Role"
                            value="All"
                            active={role !== 'ALL'}
                            menu={
                                <div className="flex flex-col gap-1 p-2.5 w-52">
                                    {(['ALL', 'TRAINEE', 'TRAINER', 'GYM'] as const).map((r) => {
                                        const activeOpt = role === r;
                                        return (
                                            <button
                                                key={r}
                                                onClick={() => setRole(r)}
                                                className={clsx(
                                                    'rounded-2xl border px-3 py-2 text-sm text-left transition capitalize',
                                                    activeOpt
                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
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
                            label="Status"
                            value={getStatusLabel(role, statusFilter)}
                            active={statusFilter !== 'ALL'}
                            menu={
                                <div className="flex flex-col gap-1 p-2.5 w-52">
                                    {generalStatusOptions.map(([value, label]) => {
                                        const activeOpt = statusFilter === value;
                                        return (
                                            <button
                                                key={value}
                                                onClick={() => setStatusFilter(value)}
                                                className={clsx(
                                                    'rounded-2xl border px-3 py-2 text-left text-sm transition',
                                                    activeOpt
                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                                )}
                                            >
                                                {label}
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
                                <div className="space-y-2.5 p-3 w-[19rem] max-w-[calc(100vw-88px)] text-sm">
                                    <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-400">
                                        trainers hourly · gyms monthly
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            className="flex-1 min-w-[92px] rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                            placeholder="Min"
                                            value={minBudget}
                                            onChange={(e) => setMinBudget(e.target.value)}
                                        />
                                        <span className="text-gray-400 dark:text-gray-500">—</span>
                                        <input
                                            type="number"
                                            min={0}
                                            className="flex-1 min-w-[92px] rounded-2xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                                            placeholder="Max"
                                            value={maxBudget}
                                            onChange={(e) => setMaxBudget(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <button
                                            onClick={() => {
                                                setMinBudget('');
                                                setMaxBudget('');
                                            }}
                                            className="rounded-full px-2 py-1 transition hover:text-gray-800 dark:hover:text-white"
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
                                <div className="flex w-56 flex-col gap-1 p-2.5 text-sm">
                                    {allGoals.map((g) => {
                                        const checked = goals.includes(g);
                                        return (
                                            <label
                                                key={g}
                                                className={clsx(
                                                    'flex items-center gap-2 rounded-2xl border px-3 py-2 transition capitalize',
                                                    checked
                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white/10 dark:text-white'
                                                        : 'border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleGoal(g)}
                                                    className="accent-gray-900 dark:accent-green-400"
                                                />
                                                <span>{g}</span>
                                            </label>
                                        );
                                    })}
                                    <button
                                        onClick={() => setGoals([])}
                                        className="mt-2 text-right text-xs text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                                    >
                                        Clear goals
                                    </button>
                                </div>
                            }
                        />
                            </>
                        )}

                        <button
                            onClick={resetFilters}
                            className="flex items-center rounded-xl border border-gray-200 bg-white/80 px-3 py-1.5 text-sm text-gray-700 uppercase tracking-wide transition hover:border-gray-400 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/30 dark:hover:bg-white/10"
                            title="Reset filters"
                        >
                            Reset
                        </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="w-full flex-1">
                    <>
                <div className="lg:hidden">
                    {mobileView === 'list' && (
                        <div className="px-4 pb-0 pt-4 space-y-4">
                            {loading ? (
                                <div className="flex items-center justify-center rounded-xl border bg-white py-6 text-sm text-gray-500 dark:bg-neutral-900 dark:border-white/10 dark:text-gray-300">
                                    <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-gray-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                                    Loading…
                                </div>
                            ) : error ? (
                                <div className="p-4 text-sm text-red-500 bg-white rounded-xl border dark:bg-neutral-900 dark:border-white/10">{error}</div>
                            ) : allResults.length ? (
                                <>
                                    <div
                                        className="max-h-[calc(100dvh-21rem-env(safe-area-inset-bottom,0px))] space-y-3 overflow-y-auto scrollbar-slim"
                                        ref={mobileListRef}
                                    >
                                        {paginatedResults.map((u) => renderMobileCard(u))}
                                    </div>
                                    <div className="flex items-center justify-between pt-1 text-xs text-gray-600 dark:text-gray-400">
                                        <button
                                            className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-40 dark:border-white/20 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
                                            disabled={page === 1}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        >
                                            Previous
                                        </button>
                                        <span>
                                            Page {page} of {totalPages}
                                        </span>
                                        <button
                                            className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-40 dark:border-white/20 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
                                            disabled={page === totalPages}
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="p-4 text-sm text-gray-500 bg-white rounded-xl border dark:bg-neutral-900 dark:border-white/10 dark:text-gray-400">No results.</div>
                            )}
                        </div>
                    )}

                    {mobileView === 'details' && (
                        <div className="px-4 py-4">
                            <button
                                onClick={() => setMobileView('list')}
                                className="mb-3 inline-flex items-center gap-2 text-sm text-green-700 dark:text-green-400"
                            >
                                <span className="text-lg">&larr;</span> Back
                            </button>
                            <div className="bg-white border rounded-xl p-4 overflow-hidden dark:bg-neutral-900 dark:border-white/10">
                                {!selected ? (
                                    <div className="text-gray-500 text-sm dark:text-gray-400">Select a result to see details.</div>
                                ) : gymDiscoveryMode ? (
                                    <GymDiscoveryPanel
                                        embedded
                                        hideList
                                        selectedGymIdOverride={selected.id}
                                        autoSelectFirst={false}
                                        query={q}
                                        hiringOnly={hiringOnly}
                                        sortBy={gymSortBy}
                                        minBudget={Number.isFinite(minBudgetValue as number) ? minBudgetValue : null}
                                        maxBudget={Number.isFinite(maxBudgetValue as number) ? maxBudgetValue : null}
                                    />
                                ) : selectedGymInAnyRole ? (
                                    <GymDiscoveryPanel
                                        embedded
                                        hideList
                                        selectedGymIdOverride={selectedGymInAnyRole.id}
                                        query={q}
                                        minBudget={Number.isFinite(minBudgetValue as number) ? minBudgetValue : null}
                                        maxBudget={Number.isFinite(maxBudgetValue as number) ? maxBudgetValue : null}
                                    />
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
                    {gymDiscoveryMode ? (
                        <div className="mx-auto max-w-[1400px] px-4 py-4">
                            <GymDiscoveryPanel
                                embedded
                                hideListHeader
                                autoSelectFirst
                                query={q}
                                hiringOnly={hiringOnly}
                                sortBy={gymSortBy}
                                minBudget={Number.isFinite(minBudgetValue as number) ? minBudgetValue : null}
                                maxBudget={Number.isFinite(maxBudgetValue as number) ? maxBudgetValue : null}
                            />
                        </div>
                    ) : (
                    <div className="mx-auto max-w-[1400px] px-4 py-4">
                        <div className="flex gap-6">
                            <aside className="w-[380px] shrink-0">
                                <div className="bg-white border rounded-xl overflow-hidden lg:h-[calc(100vh-190px)] lg:flex lg:flex-col dark:bg-neutral-900 dark:border-white/10">
                                    <div
                                        ref={listRef}
                                        className="overflow-y-auto p-4 lg:flex-1 lg:min-h-0 scrollbar-slim"
                                    >
                                        {loading ? (
                                            <div className="flex items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-400">
                                                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                                                Loading…
                                            </div>
                                        ) : error ? (
                                            <div className="py-4 text-sm text-red-500">{error}</div>
                                        ) : allResults.length === 0 ? (
                                            <div className="py-4 text-sm text-gray-500 dark:text-gray-400">No results.</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {paginatedResults.map((u) => {
                                                    const slug = u.username || u.id;
                                                    const display = u.name || u.username || 'User';
                                                    const locationLabel = [u.city, u.state].filter(Boolean).join(', ');

                                                    return (
                                                        <button
                                                            key={u.id}
                                                            onClick={() => setSelectedId(u.id)}
                                                            className={clsx(
                                                                'w-full rounded-2xl border px-4 py-3 text-left transition',
                                                                selectedId === u.id
                                                                    ? 'border-green-700 bg-green-50 dark:border-green-400 dark:bg-green-500/10'
                                                                    : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-white/30'
                                                            )}
                                                            title={display}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex min-w-0 items-start gap-3">
                                                                    {u.image ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img
                                                                            src={u.image}
                                                                            alt={display}
                                                                            className="h-11 w-11 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-white/15"
                                                                        />
                                                                    ) : (
                                                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-700 dark:border-white/15 dark:bg-white/10 dark:text-white">
                                                                            {(u.name || u.username || 'U').slice(0, 2)}
                                                                        </div>
                                                                    )}

                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <Link
                                                                                href={`/u/${encodeURIComponent(slug)}`}
                                                                                className="truncate font-semibold text-zinc-900 hover:underline dark:text-white"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                title={display}
                                                                            >
                                                                                {display}
                                                                            </Link>
                                                                        </div>
                                                                        {u.role && (
                                                                            <div className="mt-1 text-xs capitalize text-zinc-500 dark:text-gray-400">
                                                                                {u.role.toLowerCase()}
                                                                            </div>
                                                                        )}
                                                                        {locationLabel && (
                                                                            <div className="mt-1 text-sm text-zinc-600 dark:text-gray-300">
                                                                                {locationLabel}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {typeof u.distanceKm === 'number' && (
                                                                    <div className="shrink-0 text-xs text-zinc-500 dark:text-gray-400">
                                                                        {formatDistanceMiles(u.distanceKm)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    {allResults.length > 0 && (
                                        <div className="px-4 py-3 border-t flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                            <button
                                                className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-50 dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10"
                                                disabled={page === 1}
                                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            >
                                                Previous
                                            </button>
                                            <span>
                                                Page {page} of {totalPages}
                                            </span>
                                            <button
                                                className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-50 dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10"
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
                                {selectedGymInAnyRole ? (
                                    <GymDiscoveryPanel
                                        embedded
                                        hideList
                                        selectedGymIdOverride={selectedGymInAnyRole.id}
                                        query={q}
                                        minBudget={Number.isFinite(minBudgetValue as number) ? minBudgetValue : null}
                                        maxBudget={Number.isFinite(maxBudgetValue as number) ? maxBudgetValue : null}
                                    />
                                ) : (
                                    <div className="bg-white border rounded-xl p-6 min-h-[calc(100vh-190px)] dark:bg-neutral-900 dark:border-white/10">
                                        {!selected ? (
                                            <div className="text-gray-500 dark:text-gray-400">Select a result to see details.</div>
                                        ) : (
                                            <UserDetails
                                                u={selected}
                                                onMessage={handleMessage}
                                                onShare={handleShareProfile}
                                                onOpenImage={(url) => setLightboxUrl(url)}
                                            />
                                        )}
                                                            </div>
                                )}
                            </section>
                        </div>
                    </div>
                    )}
                </div>
                    </>
            </main>

            {mounted && lightboxUrl && createPortal(
                <div
                    className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center"
                    onClick={() => setLightboxUrl(null)}
                    aria-modal="true"
                    role="dialog"
                >
                    <div
                        className="bg-white p-6 rounded-xl shadow-lg relative max-w-[90vw] max-h-[90vh] dark:bg-neutral-900 dark:border dark:border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setLightboxUrl(null)}
                            className="absolute right-4 top-4 p-1 hover:bg-zinc-100 rounded-full transition dark:hover:bg-white/10"
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
    const isMobile = variant === 'mobile';
    const actionIconSize = isMobile ? 16 : 16;
    const mobileActionButtonClass = isMobile
        ? 'flex h-9 w-9 items-center justify-center rounded-full border bg-white p-0 leading-none hover:bg-gray-50 dark:border-white/20 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10'
        : 'px-3 py-1.5 rounded-full border bg-white text-sm hover:bg-gray-50 dark:border-white/20 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10';

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
                    <img src={u.image} alt="" className="w-16 h-16 rounded-full object-cover border shrink-0 dark:border-white/20" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 border flex items-center justify-center text-sm font-semibold dark:bg-white/10 dark:border-white/20 dark:text-white">
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
                                    "text-base text-gray-500 dark:text-gray-400",
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
                                className={mobileActionButtonClass}
                                title="Message"
                                onClick={() => onMessage(u)}
                            >
                                <span className="inline-flex items-center gap-1">
                                    <MessageSquare size={actionIconSize} />
                                    {!isMobile && 'Message'}
                                </span>
                            </button>
                            <button
                                className={mobileActionButtonClass}
                                title="Share profile"
                                onClick={() => onShare(u)}
                            >
                                <span className="inline-flex items-center gap-1">
                                    <Share2 size={actionIconSize} />
                                    {!isMobile && 'Share'}
                                </span>
                            </button>

                            {(u.role === 'TRAINER' || u.role === 'GYM') && (
                                <Link
                                    href={`/u/${encodeURIComponent(slug)}?rate=1`}
                                    className={mobileActionButtonClass}
                                    title={`Rate this ${u.role.toLowerCase()}`}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        <Star size={actionIconSize} />
                                        {!isMobile && 'Rate'}
                                    </span>
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className={clsx("text-sm text-gray-600 mt-1 dark:text-gray-300", variant === 'mobile' && "break-words")}>
                        {u.city}
                        {u.state ? `, ${u.state}` : ''}
                        {u.price != null && u.role !== 'GYM' && (
                            <>
                                {' '}
                                • {u.role === 'TRAINER' ? `$${u.price}/hr` : `$${u.price}`}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <hr className={clsx("my-5", variant === 'mobile' && "my-4")} />

            {/* About */}
            <div>
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-gray-800 whitespace-pre-wrap break-words dark:text-gray-200">
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
                        <div className="text-gray-700 dark:text-gray-200">{u.clients ?? 0}</div>
                    </div>
                    <div className="min-w-0">
                        <div className="font-semibold mb-1">Rating</div>
                        <div className="text-gray-700 dark:text-gray-200">{u.rating?.toFixed(1) ?? 'N/A'}</div>
                    </div>
                </section>
            )}

            {/* GYM — Amenities on its own line (description preferred) */}
            {u.role === 'GYM' && (
                <section className={clsx("mt-6", variant === 'mobile' && "mt-4")}>
                    <h3 className="font-semibold mb-2">Amenities</h3>
                    {u.amenitiesText?.trim() ? (
                        <p className="text-gray-800 whitespace-pre-wrap dark:text-gray-200">{u.amenitiesText}</p>
                    ) : u.amenities?.length ? (
                        <TagList items={u.amenities} />
                    ) : (
                        <div className="text-gray-600 dark:text-gray-400">—</div>
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
                                className="group relative aspect-square overflow-hidden rounded-lg border bg-black dark:border-white/10"
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
    if (!items.length) return <div className="text-gray-600 dark:text-gray-400">—</div>;
    return (
        <div className="flex flex-wrap gap-1">
            {items.map((x) => (
                <span key={x} className="px-2 py-0.5 rounded-full border text-xs bg-gray-50 dark:border-white/15 dark:bg-white/5">
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
    hideChevron = false,
    centerLabel = false,
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
    hideChevron?: boolean;
    centerLabel?: boolean;
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
    const spacingClass = compact ? 'gap-1.5' : 'gap-2';
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
                    compact ? 'px-3 py-1.5 text-xs' : 'px-3 py-1.5 text-sm',
                    spacingClass,
                    justifyClass,
                    active
                        ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-400 dark:bg-green-500/10 dark:text-green-200'
                        : 'border-gray-200 bg-white/80 text-gray-700 hover:border-gray-400 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/30 dark:hover:bg-white/10'
                )}
            >
                <span
                    className={clsx(
                        'whitespace-nowrap uppercase tracking-wide',
                        compact ? 'text-[10px]' : 'text-xs',
                        active ? 'text-green-700 dark:text-green-200' : 'text-gray-500 dark:text-gray-400',
                        !showValue && (centerLabel ? 'flex-1 text-center' : 'flex-1 text-left')
                    )}
                >
                    {label}
                </span>
                {showValue && (
                    <>
                        <span
                            className={clsx(
                                active ? 'bg-green-200 dark:bg-green-500/40' : 'bg-gray-200 dark:bg-white/20',
                                compact ? 'h-3 w-px' : 'h-4 w-px'
                            )}
                            aria-hidden="true"
                        />
                        <span className={clsx('truncate', fluid ? 'flex-1 text-right' : 'max-w-[120px]')}>
                            {value}
                        </span>
                    </>
                )}
                {!hideChevron && (
                    <ChevronDown
                        size={compact ? 14 : 16}
                        className={clsx('shrink-0', active ? 'text-green-700 dark:text-green-200' : 'text-gray-500 dark:text-gray-400')}
                    />
                )}
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
                                ? 'fixed left-1/2 z-40 -translate-x-1/2 rounded-2xl border border-gray-200 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur w-[calc(100vw-32px)] max-w-[20rem] dark:border-white/10 dark:bg-neutral-900/95 dark:text-gray-100'
                                : 'absolute z-20 mt-2 rounded-2xl border border-gray-200 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur dark:border-white/10 dark:bg-neutral-900/95 dark:text-gray-100',
                            menuFixed ? '' : menuPosition ?? 'right-0',
                            menuClassName ?? (menuFixed ? '' : 'min-w-[220px]')
                        )}
                        style={
                            menuFixed
                                ? { top: menuTop ?? (wrapperRef.current?.getBoundingClientRect().bottom ?? 0) + 8 }
                                : undefined
                        }
                    >
                        <div className="flex justify-end px-1.5 pt-1.5">
                            <button
                                onClick={() => {
                                    setOpen(false);
                                    setMenuTop(null);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10"
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="px-3 pb-3">
                            {menu}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function ToggleChip({
    label,
    active = false,
    onClick,
    size = 'default',
    fluid = false,
}: {
    label: string;
    active?: boolean;
    onClick: () => void;
    size?: 'default' | 'compact';
    fluid?: boolean;
}) {
    const compact = size === 'compact';

    return (
        <button
            type="button"
            onClick={onClick}
            className={clsx(
                'flex items-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
                fluid ? 'w-full justify-center' : '',
                compact ? 'px-3 py-1.5 text-xs' : 'min-h-[34px] px-3 py-1.5 text-sm',
                active
                    ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-400 dark:bg-green-500/10 dark:text-green-200'
                    : 'border-gray-200 bg-white/80 text-gray-700 hover:border-gray-400 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/30 dark:hover:bg-white/10'
            )}
        >
            <span
                className={clsx(
                    'whitespace-nowrap uppercase tracking-wide',
                    compact ? 'text-[10px]' : 'text-xs',
                    active ? 'text-green-700 dark:text-green-200' : 'text-gray-500 dark:text-gray-400'
                )}
            >
                {label}
            </span>
        </button>
    );
}
