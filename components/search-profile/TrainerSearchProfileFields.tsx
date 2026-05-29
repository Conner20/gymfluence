'use client';

import { useEffect, useState } from "react";
import clsx from "clsx";

type GymSuggestion = {
    id: string;
    name: string;
    address?: string | null;
};

type TrainerSearchProfileFieldsProps = {
    services: string[];
    choices: string[];
    hourlyRate: string;
    trainerGymStatus: "" | "LOOKING" | "TRAINER";
    associatedGym: GymSuggestion | null;
    showWebsiteButton: boolean;
    website: string;
    onToggleService: (service: string) => void;
    onHourlyRateChange: (value: string) => void;
    onHourlyRateBlur: () => void;
    onTrainerGymStatusChange: (value: "" | "LOOKING" | "TRAINER") => void;
    onAssociatedGymChange: (gym: GymSuggestion | null) => void;
    associatedGymInvalid: boolean;
    onWebsiteChange: (value: string) => void;
    onToggleShowWebsite: () => void;
};

export default function TrainerSearchProfileFields({
    services,
    choices,
    hourlyRate,
    trainerGymStatus,
    associatedGym,
    showWebsiteButton,
    website,
    onToggleService,
    onHourlyRateChange,
    onHourlyRateBlur,
    onTrainerGymStatusChange,
    onAssociatedGymChange,
    associatedGymInvalid,
    onWebsiteChange,
    onToggleShowWebsite,
}: TrainerSearchProfileFieldsProps) {
    return (
        <div className="mb-6 space-y-6">
            <div>
                <label className="mb-2 block text-sm font-medium">Services</label>
                <div className="flex flex-wrap gap-2">
                    {choices.map((service) => (
                        <button
                            key={service}
                            type="button"
                            onClick={() => onToggleService(service)}
                            className={clsx(
                                "rounded-full border px-3 py-2 text-xs font-medium leading-none transition-colors sm:px-3.5 sm:py-1.5 sm:text-[13px]",
                                services.includes(service)
                                    ? "border-green-700 bg-green-700 text-white hover:bg-green-800 dark:border-green-500 dark:bg-green-500 dark:text-black dark:hover:border-green-400 dark:hover:bg-green-400"
                                    : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                            )}
                        >
                            {service}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium">Gym status</label>
                <div className="flex flex-wrap gap-2">
                    {[
                        { value: "LOOKING" as const, label: "I'm looking for a gym" },
                        { value: "TRAINER" as const, label: "I'm a trainer at a gym" },
                    ].map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                                onTrainerGymStatusChange(
                                    trainerGymStatus === option.value ? "" : option.value
                                )
                            }
                            className={clsx(
                                "rounded-full border px-3 py-2 text-xs font-medium leading-none transition-colors sm:px-3.5 sm:py-1.5 sm:text-[13px]",
                                trainerGymStatus === option.value
                                    ? "border-green-700 bg-green-700 text-white hover:bg-green-800 dark:border-green-500 dark:bg-green-500 dark:text-black dark:hover:border-green-400 dark:hover:bg-green-400"
                                    : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {trainerGymStatus === "TRAINER" && (
                    <GymAutocomplete
                        value={associatedGym}
                        onChange={onAssociatedGymChange}
                        invalid={associatedGymInvalid}
                    />
                )}
            </div>

            <div className="w-full max-w-xs">
                <label className="mb-1 block text-sm font-medium">Hourly rate</label>
                <div className="flex items-center rounded-md border px-3 dark:border-white/20">
                    <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">$</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        className="w-full bg-transparent px-2 py-2 text-sm outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:text-gray-100"
                        placeholder="0.00"
                        value={hourlyRate}
                        onChange={(e) => onHourlyRateChange(e.target.value)}
                        onBlur={onHourlyRateBlur}
                    />
                    <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">/hour</span>
                </div>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-white/10">
                <div className="flex flex-nowrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 pr-2">
                        <p className="whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">Show website on profile</p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={showWebsiteButton}
                        onClick={onToggleShowWebsite}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                            showWebsiteButton ? "bg-green-700 dark:bg-green-500" : "bg-gray-300 dark:bg-neutral-700"
                        }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                showWebsiteButton ? "translate-x-5" : "translate-x-1"
                            }`}
                        />
                    </button>
                </div>

                {showWebsiteButton && (
                    <div>
                        <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                            Website URL
                        </label>
                        <input
                            type="url"
                            className="w-full rounded border px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:border-white/10 dark:bg-transparent dark:text-gray-100"
                            value={website}
                            onChange={(e) => onWebsiteChange(e.target.value)}
                            placeholder="https://example.com"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function GymAutocomplete({
    value,
    onChange,
    invalid = false,
}: {
    value: GymSuggestion | null;
    onChange: (value: GymSuggestion | null) => void;
    invalid?: boolean;
}) {
    const [input, setInput] = useState(value?.name ?? "");
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<GymSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setInput(value?.name ?? "");
    }, [value]);

    useEffect(() => {
        const selectedValue = value?.name ?? "";
        if (selectedValue && input === selectedValue) {
            setSuggestions([]);
            setOpen(false);
            setLoading(false);
            setError(null);
            return;
        }

        if (!input || input.length < 2) {
            setSuggestions([]);
            setOpen(false);
            setError(null);
            return;
        }

        const handle = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/gym-search?q=${encodeURIComponent(input)}`);
                const json = await res.json();
                if (!res.ok) {
                    throw new Error(json?.message || "Unable to search gyms.");
                }
                const results = json.results || [];
                setSuggestions(results);
                setOpen(true);
            } catch (err) {
                setSuggestions([]);
                setOpen(false);
                setError(err instanceof Error ? err.message : "Unable to search gyms.");
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => clearTimeout(handle);
    }, [input, value]);

    return (
        <div className="relative">
            <input
                className={`w-full border rounded px-3 py-2 text-sm outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:text-gray-100 ${
                    invalid ? "border-red-500 dark:border-red-500" : "dark:border-white/10"
                }`}
                value={input}
                onChange={(e) => {
                    const next = e.target.value;
                    setInput(next);
                    if (value && next !== value.name) {
                        onChange(null);
                    }
                }}
                onFocus={() => {
                    if (suggestions.length) setOpen(true);
                }}
                onBlur={() => {
                    window.setTimeout(() => setOpen(false), 150);
                }}
                placeholder="Search gyms"
            />
            {loading && (
                <div className="absolute right-3 top-2.5 text-xs text-gray-400 dark:text-gray-500">
                    …
                </div>
            )}
            {open && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow max-h-60 overflow-y-auto dark:bg-neutral-900 dark:border-white/10">
                    {suggestions.map((gym) => (
                        <button
                            key={gym.id}
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/10"
                            onClick={() => {
                                onChange(gym);
                                setInput(gym.name);
                                setSuggestions([]);
                                setOpen(false);
                            }}
                        >
                            <div className="text-sm font-medium dark:text-gray-100">{gym.name}</div>
                            {gym.address && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{gym.address}</div>
                            )}
                        </button>
                    ))}
                </div>
            )}
            {open && !loading && input.length >= 2 && suggestions.length === 0 && !error && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-500 shadow dark:bg-neutral-900 dark:border-white/10 dark:text-gray-400">
                    No matching gyms found.
                </div>
            )}
            {error && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
        </div>
    );
}
