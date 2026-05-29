'use client';

import { useEffect, useState } from "react";
import clsx from "clsx";

type TrainerSuggestion = {
    id: string;
    username: string | null;
    name: string | null;
};

type GymSuggestion = {
    id: string;
    name: string;
    address?: string | null;
};

type TraineeSearchProfileFieldsProps = {
    goals: string[];
    choices: string[];
    traineeTrainerStatus: "" | "LOOKING" | "TRAINING_WITH";
    traineeGymStatus: "" | "LOOKING" | "MEMBER";
    associatedTrainer: TrainerSuggestion | null;
    associatedGym: GymSuggestion | null;
    trainerInvalid: boolean;
    gymInvalid: boolean;
    onToggleGoal: (goal: string) => void;
    onTrainerStatusChange: (value: "" | "LOOKING" | "TRAINING_WITH") => void;
    onGymStatusChange: (value: "" | "LOOKING" | "MEMBER") => void;
    onAssociatedTrainerChange: (trainer: TrainerSuggestion | null) => void;
    onAssociatedGymChange: (gym: GymSuggestion | null) => void;
};

export default function TraineeSearchProfileFields({
    goals,
    choices,
    traineeTrainerStatus,
    traineeGymStatus,
    associatedTrainer,
    associatedGym,
    trainerInvalid,
    gymInvalid,
    onToggleGoal,
    onTrainerStatusChange,
    onGymStatusChange,
    onAssociatedTrainerChange,
    onAssociatedGymChange,
}: TraineeSearchProfileFieldsProps) {
    return (
        <div className="mb-6 space-y-6">
            <div>
                <label className="mb-2 block text-sm font-medium">Goals</label>
                <div className="flex flex-wrap gap-2">
                    {choices.map((goal) => (
                        <button
                            key={goal}
                            type="button"
                            onClick={() => onToggleGoal(goal)}
                            className={clsx(
                                "rounded-full border px-3 py-2 text-xs font-medium leading-none transition-colors sm:px-3.5 sm:py-1.5 sm:text-[13px]",
                                goals.includes(goal)
                                    ? "border-green-700 bg-green-700 text-white hover:bg-green-800 dark:border-green-500 dark:bg-green-500 dark:text-black dark:hover:border-green-400 dark:hover:bg-green-400"
                                    : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                            )}
                        >
                            {goal}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium">Trainer status</label>
                <div className="flex flex-wrap gap-2">
                    {[
                        { value: "LOOKING" as const, label: "I'm looking for a trainer" },
                        { value: "TRAINING_WITH" as const, label: "I have a trainer" },
                    ].map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                                onTrainerStatusChange(
                                    traineeTrainerStatus === option.value ? "" : option.value
                                )
                            }
                            className={clsx(
                                "rounded-full border px-3 py-2 text-xs font-medium leading-none transition-colors sm:px-3.5 sm:py-1.5 sm:text-[13px]",
                                traineeTrainerStatus === option.value
                                    ? "border-green-700 bg-green-700 text-white hover:bg-green-800 dark:border-green-500 dark:bg-green-500 dark:text-black dark:hover:border-green-400 dark:hover:bg-green-400"
                                    : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {traineeTrainerStatus === "TRAINING_WITH" && (
                    <TrainerAutocomplete
                        value={associatedTrainer}
                        onChange={onAssociatedTrainerChange}
                        invalid={trainerInvalid}
                    />
                )}
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium">Gym status</label>
                <div className="flex flex-wrap gap-2">
                    {[
                        { value: "LOOKING" as const, label: "I'm looking for a gym" },
                        { value: "MEMBER" as const, label: "I'm a member at a gym" },
                    ].map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                                onGymStatusChange(
                                    traineeGymStatus === option.value ? "" : option.value
                                )
                            }
                            className={clsx(
                                "rounded-full border px-3 py-2 text-xs font-medium leading-none transition-colors sm:px-3.5 sm:py-1.5 sm:text-[13px]",
                                traineeGymStatus === option.value
                                    ? "border-green-700 bg-green-700 text-white hover:bg-green-800 dark:border-green-500 dark:bg-green-500 dark:text-black dark:hover:border-green-400 dark:hover:bg-green-400"
                                    : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {traineeGymStatus === "MEMBER" && (
                    <GymAutocomplete
                        value={associatedGym}
                        onChange={onAssociatedGymChange}
                        invalid={gymInvalid}
                    />
                )}
            </div>
        </div>
    );
}

function TrainerAutocomplete({
    value,
    onChange,
    invalid = false,
}: {
    value: TrainerSuggestion | null;
    onChange: (value: TrainerSuggestion | null) => void;
    invalid?: boolean;
}) {
    const [input, setInput] = useState(value?.username ?? value?.name ?? "");
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<TrainerSuggestion[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setInput(value?.username ?? value?.name ?? "");
    }, [value]);

    useEffect(() => {
        const selectedValue = value?.username ?? value?.name ?? "";
        if (selectedValue && input === selectedValue) {
            setSuggestions([]);
            setOpen(false);
            setLoading(false);
            return;
        }

        if (!input || input.length < 2) {
            setSuggestions([]);
            setOpen(false);
            return;
        }

        const handle = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/trainer-search?q=${encodeURIComponent(input)}`);
                if (!res.ok) throw new Error();
                const json = await res.json();
                const results = json.results || [];
                setSuggestions(results);
                setOpen(true);
            } catch {
                setSuggestions([]);
                setOpen(false);
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
                    if (value && next !== (value.username ?? value.name ?? "")) {
                        onChange(null);
                    }
                }}
                onFocus={() => {
                    if (suggestions.length) setOpen(true);
                }}
                onBlur={() => {
                    window.setTimeout(() => setOpen(false), 150);
                }}
                placeholder="Search trainers"
            />
            {loading && (
                <div className="absolute right-3 top-2.5 text-xs text-gray-400 dark:text-gray-500">
                    …
                </div>
            )}
            {open && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow max-h-60 overflow-y-auto dark:bg-neutral-900 dark:border-white/10">
                    {suggestions.map((trainer) => (
                        <button
                            key={trainer.id}
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/10"
                            onClick={() => {
                                onChange(trainer);
                                setInput(trainer.username ?? trainer.name ?? "");
                                setSuggestions([]);
                                setOpen(false);
                            }}
                        >
                            <div className="text-sm font-medium dark:text-gray-100">
                                {trainer.username || trainer.name || "Trainer"}
                            </div>
                            {trainer.name && trainer.username && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{trainer.name}</div>
                            )}
                        </button>
                    ))}
                </div>
            )}
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
