'use client'

import { Suspense, useState, type JSX } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowRight } from 'lucide-react';

const roleOptions = [
    { label: "Trainee" },
    { label: "Trainer" },
    { label: "Gym" },
];

const LOCKED_PAGE_CLASS = "bg-neutral-50 text-zinc-900 dark:bg-neutral-50 dark:text-zinc-900";

function UserOnboardingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { update } = useSession();
    const userName = searchParams?.get('username') ?? 'there';

    const [role, setRole] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const finalizeOnboarding = async () => {
        try {
            await update();
        } catch (error) {
            console.error("Session refresh failed:", error);
        }

        router.replace("/home");
        router.refresh();

        if (typeof window !== "undefined") {
            window.location.assign("/home");
        }
    };

    const handleRoleNext = async () => {
        if (!role || submitting) return;

        setSubmitting(true);
        try {
            const res = await fetch("/api/user/update-role", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    role: role.toUpperCase(),
                }),
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                console.error("Update role failed:", errJson);
                throw new Error(errJson?.message || "Failed to update role");
            }

            await res.json();
            await finalizeOnboarding();
        } catch (err) {
            console.error("Update failed:", err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={`w-full min-h-screen flex flex-col items-center justify-center px-4 py-6 sm:py-10 ${LOCKED_PAGE_CLASS}`}>
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
                                onClick={() => setRole(label)}
                                className={`flex h-full w-full flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition ${
                                    isSelected
                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                        : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400'
                                }`}
                            >
                                <span className="text-xl font-semibold">{label}</span>
                                <span className="text-sm text-zinc-500">
                                    {label === 'Trainee'
                                        ? 'Discover gyms, trainers, and a community that fits your goals.'
                                        : label === 'Trainer'
                                            ? 'Grow your brand, attract clients, and find new opportunities.'
                                            : 'Showcase your facility, attract members, and connect with trainers.'}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <button
                    className={`mt-2 inline-flex h-14 w-14 items-center justify-center rounded-full border border-zinc-900 text-zinc-900 transition ${
                        role && !submitting ? 'hover:bg-zinc-900 hover:text-white' : 'cursor-not-allowed opacity-30'
                    }`}
                    disabled={!role || submitting}
                    onClick={() => void handleRoleNext()}
                    aria-label="Next"
                >
                    <ArrowRight size={28} />
                </button>
            </div>
        </div>
    );
}

export default function UserOnboarding() {
    return (
        <Suspense
            fallback={
                <div className={`w-full min-h-screen flex items-center justify-center ${LOCKED_PAGE_CLASS}`}>
                    <span className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                </div>
            }
        >
            <UserOnboardingContent />
        </Suspense>
    );
}
