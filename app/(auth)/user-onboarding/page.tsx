'use client'

import { Suspense, useState, type JSX } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "../../../components/ui/form";
import { Input } from '../../../components/ui/input';
import { Button } from "../../../components/ui/button";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const OPTIONS = [
    "weight loss", "build strength", "improve endurance",
    "flexibility & mobility", "sport performance", "injury recovery"
];

// TOP: update GymFormSchema so fee is a number (coerced from input)
// in user-onboarding/page.tsx
const GymFormSchema = z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    phone: z.string().min(1),
    website: z.string().min(1),
    fee: z.coerce.number().positive("Fee must be a positive number"),
});
type GymFormValues = z.infer<typeof GymFormSchema>;



const roleOptions = [
    { label: "Trainee" },
    { label: "Trainer" },
    { label: "Gym" },
];

const LOCKED_PAGE_CLASS = "bg-neutral-50 text-zinc-900 dark:bg-neutral-50 dark:text-zinc-900";
const LOCKED_CARD_CLASS = "w-full max-w-sm space-y-6 rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-xl shadow-zinc-100 dark:border-zinc-200 dark:bg-white/95 dark:shadow-zinc-100";
const LOCKED_INPUT_CLASS = "bg-white text-zinc-900 border border-zinc-200 placeholder:text-zinc-500 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 dark:bg-white dark:text-zinc-900 dark:border-zinc-200 dark:placeholder:text-zinc-500 dark:focus-visible:border-emerald-600 dark:focus-visible:ring-emerald-600/20";
const LOCKED_PRIMARY_BUTTON = "rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 transition dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700";
const LOCKED_TEXT_BUTTON = "text-sm text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-800";





function UserOnboardingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const userName = searchParams?.get('username') ?? 'there';

    const [step, setStep] = useState(1);
    const [role, setRole] = useState<string | null>(null);
    const [selections, setSelections] = useState<string[]>([]);

    const gymFormHook = useForm<GymFormValues>({
        resolver: zodResolver(GymFormSchema) as any,
        defaultValues: {
            name: "",
            address: "",
            phone: "",
            website: "",
            fee: 0,
        },
    });

    const handleRoleCardSelect = (r: string) => {
        setRole(r);
    };

    const handleRoleNext = () => {
        if (role) setStep(2);
    };

    const toggleSelection = (option: string) => {
        setSelections(selections =>
            selections.includes(option)
                ? selections.filter(o => o !== option)
                : [...selections, option]
        );
    };

    const handleGymProfileSubmit = gymFormHook.handleSubmit(async (values) => {
        try {
            const res = await fetch("/api/user/update-role", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    role: "GYM",
                    gymForm: values,   // fee is already a number
                    selections: [],
                }),
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                console.error("Update role failed:", errJson);
                throw new Error(errJson?.message || "Failed to update role");
            }

            const data = await res.json();
            console.log("User updated:", data);
            router.push("/log-in");
            // route wherever you want after onboarding
        } catch (err) {
            console.error(err);
        }
    });


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/user/update-role", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    role: role?.toUpperCase(),
                    selections,
                    // No gymForm here
                }),
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                console.error("Update role failed:", errJson);
                throw new Error(errJson?.message || "Failed to update role");
            }

            const data = await res.json();
            console.log("User updated:", data);
            router.push("/profile");
        } catch (err) {
            console.error("Update failed:", err);
        }
    };

    if (step === 2 && role === 'Gym') {
        return (
            <div className={`flex h-screen w-full items-center justify-center px-4 ${LOCKED_PAGE_CLASS}`}>
                <div className={LOCKED_CARD_CLASS}>
                    <div className="space-y-1 text-center">
                        <h2 className="text-2xl font-semibold text-zinc-900">Create your gym profile</h2>
                        <p className="text-sm text-zinc-500">Share the essentials so members can find you faster.</p>
                    </div>
                    <Form {...gymFormHook}>
                        <form onSubmit={handleGymProfileSubmit} className="w-full space-y-5">
                            <FormField
                                control={gymFormHook.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-1 text-sm font-medium text-zinc-800">
                                            Organization name
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Gym or facility name"
                                                className={`${LOCKED_INPUT_CLASS} rounded-2xl px-4 py-2 text-sm`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-1 text-sm font-medium text-zinc-800">
                                            Address
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Street, city, state"
                                                className={`${LOCKED_INPUT_CLASS} rounded-2xl px-4 py-2 text-sm`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-1 text-sm font-medium text-zinc-800">
                                            Phone number
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="(555) 123-4567"
                                                className={`${LOCKED_INPUT_CLASS} rounded-2xl px-4 py-2 text-sm`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="website"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-1 text-sm font-medium text-zinc-800">
                                            Website
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="https://..."
                                                className={`${LOCKED_INPUT_CLASS} rounded-2xl px-4 py-2 text-sm`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="fee"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-1 text-sm font-medium text-zinc-800">
                                            Monthly membership fee
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder="e.g., 99"
                                                className={`${LOCKED_INPUT_CLASS} rounded-2xl px-4 py-2 text-sm`}
                                                value={
                                                    field.value === undefined || Number.isNaN(field.value)
                                                        ? ''
                                                        : field.value
                                                }
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value)
                                                    )
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="space-y-3">
                                <Button className={`w-full ${LOCKED_PRIMARY_BUTTON}`} type="submit">Publish profile</Button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRole(null);
                                        setStep(1);
                                    }}
                                    className={`w-full ${LOCKED_TEXT_BUTTON}`}
                                >
                                    ← Back
                                </button>
                            </div>
                        </form>
                    </Form>
                </div>
            </div>
        );
    }

    return (
        <div className={`w-full min-h-screen flex flex-col items-center justify-center px-4 py-6 sm:py-10 ${LOCKED_PAGE_CLASS}`}>
            {step === 1 && (
                <div className="flex w-full max-w-5xl flex-col items-center">
                    <div className="mb-8 text-center space-y-2">
                        <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Onboarding</p>
                        <h2 className="text-3xl font-semibold">
                            Hi {userName}, choose your role
                        </h2>
                        <p className="text-sm text-zinc-500">
                            This helps us tailor the experience to your needs.
                        </p>
                    </div>
                    <div className="mb-12 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {roleOptions.map(({ label }) => {
                            const isSelected = role === label;
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => handleRoleCardSelect(label)}
                                    className={`flex h-full w-full flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition ${
                                        isSelected
                                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                            : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400'
                                    }`}
                                >
                                    <span className="text-xl font-semibold">{label}</span>
                                    <span className="text-sm text-zinc-500">
                                        {label === 'Trainee'
                                            ? 'Track progress and stay accountable.'
                                            : label === 'Trainer'
                                                ? 'Manage clients and programming.'
                                                : 'Grow and showcase your facility.'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <button
                        className={`mt-2 inline-flex h-14 w-14 items-center justify-center rounded-full border border-zinc-900 text-zinc-900 transition ${
                            role ? 'hover:bg-zinc-900 hover:text-white' : 'cursor-not-allowed opacity-30'
                        }`}
                        disabled={!role}
                        onClick={handleRoleNext}
                        aria-label="Next"
                    >
                        <ArrowRight size={28} />
                    </button>
                </div>
            )}

            {step === 2 && (role === 'Trainee' || role === 'Trainer') && (
                <div className="flex w-full max-w-5xl flex-col items-center gap-8 px-4">
                    <div className="text-center space-y-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                            {role === 'Trainee' ? 'Goals' : 'Services'}
                        </p>
                        <h2 className="text-2xl font-semibold text-zinc-900">
                            {role === 'Trainee' ? 'What are you focusing on?' : 'What do you offer clients?'}
                        </h2>
                        <p className="text-sm text-zinc-500">
                            Select all that apply. This helps personalize your experience.
                        </p>
                    </div>
                    <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {OPTIONS.map((option) => {
                            const isSelected = selections.includes(option);
                            const formatted = option.replace(/(^|\s)\S/g, (t) => t.toUpperCase());
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => toggleSelection(option)}
                                    className={`flex h-full w-full rounded-2xl border px-4 py-4 text-left transition ${
                                        isSelected
                                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                            : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-white'
                                    }`}
                                >
                                    <span className="text-lg font-medium">{formatted}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setStep(1)}
                            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-900 text-zinc-900 transition hover:bg-zinc-900 hover:text-white"
                            aria-label="Back"
                        >
                            ←
                        </button>
                        <button
                            type="button"
                            disabled={selections.length === 0}
                            onClick={handleSubmit}
                            className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${
                                selections.length > 0
                                    ? 'border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                                    : 'border-zinc-300 text-zinc-300 cursor-not-allowed'
                            }`}
                            aria-label="Next"
                        >
                            →
                        </button>
                    </div>
                </div>
            )}

            {step === 2 && role === 'Gym' && (
                <div className={`flex h-screen w-full items-center justify-center px-4 ${LOCKED_PAGE_CLASS}`}>
                    <div className={LOCKED_CARD_CLASS}>
                        <div className="flex items-center justify-between text-sm">
                            <button
                                type="button"
                                onClick={() => {
                                    setRole(null);
                                    setStep(1);
                                }}
                                className={LOCKED_TEXT_BUTTON}
                            >
                                ← Back
                            </button>
                        </div>
                        <div className="space-y-1 text-center">
                            <h2 className="text-2xl font-semibold text-zinc-900">Create your gym profile</h2>
                            <p className="text-sm text-zinc-500">Share the essentials so members can find you faster.</p>
                        </div>
                    <Form {...gymFormHook}>
                        <form onSubmit={handleGymProfileSubmit} className="w-full space-y-5">
                            <FormField
                                control={gymFormHook.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-1 text-sm font-medium text-zinc-800">
                                            Organization name
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Gym or facility name"
                                                className={`${LOCKED_INPUT_CLASS} rounded-2xl px-4 py-2 text-sm`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-1 text-sm font-medium text-zinc-800">
                                            Address
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Street, city, state"
                                                className={`${LOCKED_INPUT_CLASS} rounded-2xl px-4 py-2 text-sm`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-1 text-sm font-medium text-zinc-800">
                                            Phone number
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="(555) 123-4567"
                                                className={`${LOCKED_INPUT_CLASS} rounded-2xl px-4 py-2 text-sm`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="website"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-1 text-sm font-medium text-zinc-800">
                                            Website
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="https://..."
                                                className={`${LOCKED_INPUT_CLASS} rounded-2xl px-4 py-2 text-sm`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={gymFormHook.control}
                                name="fee"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="mb-1 text-sm font-medium text-zinc-800">
                                            Monthly membership fee
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder="e.g., 99"
                                                className={`${LOCKED_INPUT_CLASS} rounded-2xl px-4 py-2 text-sm`}
                                                value={
                                                    field.value === undefined || Number.isNaN(field.value)
                                                        ? ''
                                                        : field.value
                                                }
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value)
                                                    )
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button className={`w-full mt-6 ${LOCKED_PRIMARY_BUTTON}`} type="submit">Publish profile</Button>
                        </form>
                    </Form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function UserOnboarding() {
    return (
        <Suspense fallback={<div className={`w-full min-h-screen flex items-center justify-center ${LOCKED_PAGE_CLASS}`}>Loading...</div>}>
            <UserOnboardingContent />
        </Suspense>
    );
}
