'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import clsx from "clsx";

type Role = "TRAINEE" | "TRAINER" | "GYM" | null;

type SearchProfileEditorProps = {
    // A counter from the parent: whenever it changes, we run our own onSave().
    externalSaveTrigger?: number;
};

export default function SearchProfileEditor({
    externalSaveTrigger,
}: SearchProfileEditorProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [savedState, setSavedState] = useState<'idle' | 'saving' | 'saved'>('idle');

    const [role, setRole] = useState<Role>(null);
    const [about, setAbout] = useState("");
    const [goals, setGoals] = useState<string[]>([]);
    const [services, setServices] = useState<string[]>([]);
    const [hourlyRate, setHourlyRate] = useState<string>("");
    const [gymFee, setGymFee] = useState<string>("");
    const [amenitiesText, setAmenitiesText] = useState<string>(""); // NEW: free-form amenities

    // gallery
    const [gallery, setGallery] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    // NEW: custom add fields
    const [newService, setNewService] = useState("");

    const coreGoals = [
        "weight loss",
        "build strength",
        "improve endurance",
        "flexibility & mobility",
        "sport performance",
        "injury recovery",
    ];

    // Unique lists that include any custom items user already has
    const traineeChoices = useMemo(() => {
        const set = new Set<string>([...coreGoals, ...goals]);
        return Array.from(set);
    }, [goals]);

    const trainerChoices = useMemo(() => {
        const set = new Set<string>([...coreGoals, ...services]); // reusing coreGoals as sensible defaults
        return Array.from(set);
    }, [services]);

    useEffect(() => {
        (async () => {
            try {
                setErr(null);
                setLoading(true);

                const [profRes, galRes] = await Promise.all([
                    fetch("/api/user/search-profile", { cache: "no-store" }),
                    fetch("/api/user/search-gallery", { cache: "no-store" }),
                ]);

                if (!profRes.ok) throw new Error("Failed to load search profile");
                const prof = await profRes.json();

                setRole(prof.role ?? null);
                setAbout(prof.about ?? "");

                if (prof.role === "TRAINEE") {
                    setGoals(prof.goals ?? []);
                } else if (prof.role === "TRAINER") {
                    setServices(prof.services ?? []);
                    setHourlyRate(
                        prof.hourlyRate == null ? "" : String(prof.hourlyRate)
                    );
                } else if (prof.role === "GYM") {
                    setGymFee(prof.gymFee == null ? "" : String(prof.gymFee));
                    setAmenitiesText(prof.amenitiesText ?? ""); // NEW
                }

                if (galRes.ok) {
                    const g = await galRes.json();
                    setGallery(Array.isArray(g.urls) ? g.urls : []);
                }
            } catch (e) {
                setErr("Failed to load.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const toggle = (value: string, list: string[], setList: (v: string[]) => void) => {
        const v = value.trim();
        if (!v) return;
        setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    };

    const addCustom = (value: string, list: string[], setList: (v: string[]) => void, clear: () => void) => {
        const v = value.trim();
        if (!v) return;
        if (!list.includes(v)) setList([...list, v]);
        clear();
    };

    // Make onSave stable so useEffect can depend on it
    const onSave = useCallback(
        async (silent = false) => {
            try {
                if (!silent) {
                    setSaving(true);
                    setSavedState('saving');
                }
                setErr(null);

                const payload: any = { about };
                if (role === "TRAINEE") payload.goals = goals;
                if (role === "TRAINER") {
                    payload.services = services;
                    payload.hourlyRate = hourlyRate === "" ? null : Number(hourlyRate);
                }
                if (role === "GYM") {
                    payload.gymFee = gymFee === "" ? null : Number(gymFee);
                    payload.amenitiesText = amenitiesText; // NEW
                }

                const res = await fetch("/api/user/search-profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error();
            } catch {
                setErr("Failed to save.");
            } finally {
                if (!silent) {
                    setSaving(false);
                    setSavedState('saved');
                    setTimeout(() => setSavedState('idle'), 2000);
                }
            }
        },
        [about, role, goals, services, hourlyRate, gymFee, amenitiesText],
    );

    const onUpload = async (files: File[]) => {
        if (!files.length) return;
        const form = new FormData();
        files.forEach((f) => form.append("images", f));
        const res = await fetch("/api/user/search-gallery", { method: "POST", body: form });
        if (res.ok) {
            const data = await res.json();
            setGallery((g) => [...g, ...(data.urls ?? [])]);
        }
    };

    const onRemove = async (url: string) => {
        const res = await fetch("/api/user/search-gallery", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });
        if (res.ok) setGallery((g) => g.filter((u) => u !== url));
    };

    const roleLabel = useMemo(() => (role ? role.toLowerCase() : "profile"), [role]);

    // Watch the external trigger from the parent and run onSave whenever it changes
    const lastTriggerRef = useRef<number | undefined>(externalSaveTrigger);
    useEffect(() => {
        if (externalSaveTrigger === undefined) return;

        if (lastTriggerRef.current === undefined) {
            lastTriggerRef.current = externalSaveTrigger;
            return;
        }

        if (externalSaveTrigger !== lastTriggerRef.current) {
            lastTriggerRef.current = externalSaveTrigger;
            // Trigger a save of the Search Profile silently
            onSave(true);
        }
    }, [externalSaveTrigger, onSave]);

    return (
        <section>
            <h2 className="font-semibold mb-2">Search Profile</h2>
            <p className="text-sm text-gray-600 mb-5 dark:text-gray-400">
                Customize what appears on <span className="font-medium">Search</span> for your {roleLabel}.
                Your profile picture, name, and city/country come from your main profile.
            </p>

            {loading ? (
                <div className="text-gray-500">Loading…</div>
            ) : (
                <>
                    {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

                    {/* About */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-1">About</label>
                        <textarea
                            className="w-full min-h-[100px] border rounded-md px-3 py-2 text-sm dark:bg-transparent dark:border-white/20 dark:text-gray-100"
                            placeholder="Tell people about yourself…"
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                        />
                        <div className="text-xs text-gray-500 mt-1 dark:text-gray-400">Shown on your Search details card.</div>
                    </div>

                    {/* Role-specific fields */}
                    {role === "TRAINEE" && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">Goals</label>

                            {/* Preset toggles */}
                            <div className="flex flex-wrap gap-2 mb-3">
                                {traineeChoices.map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => toggle(g, goals, setGoals)}
                                        className={clsx(
                                            "px-3 py-1 rounded-full border text-sm transition",
                                            goals.includes(g)
                                                ? "bg-green-600 text-white border-green-600 hover:bg-green-700 shadow-sm dark:bg-green-600 dark:hover:bg-green-700 dark:hover:border-green-700 dark:text-white dark:border-green-600"
                                                : "bg-white hover:bg-gray-100 text-gray-900 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                        )}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>

                        </div>
                    )}

                    {role === "TRAINER" && (
                        <>
                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-2">Services</label>

                                {/* Preset toggles (re-using core goals as common service categories) */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {trainerChoices.map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => toggle(s, services, setServices)}
                                            className={clsx(
                                                "px-3 py-1 rounded-full border text-sm transition",
                                                services.includes(s)
                                                    ? "bg-green-600 text-white border-green-600 hover:bg-green-700 shadow-sm dark:bg-green-600 dark:hover:bg-green-700 dark:hover:border-green-700 dark:text-white dark:border-green-600"
                                                    : "bg-white hover:bg-gray-100 text-gray-900 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                            )}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6 max-w-xs">
                                <label className="block text-sm font-medium mb-1">Hourly rate ($/hr)</label>
                                <input
                                    type="number"
                                    min={0}
                                    step="1"
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                    placeholder="e.g., 60"
                                    value={hourlyRate}
                                    onChange={(e) => setHourlyRate(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {role === "GYM" && (
                        <>
                            <div className="mb-6 max-w-xs">
                                <label className="block text-sm font-medium mb-1">Monthly fee ($/mo)</label>
                                <input
                                    type="number"
                                    min={0}
                                    step="1"
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                    placeholder="e.g., 30"
                                    value={gymFee}
                                    onChange={(e) => setGymFee(e.target.value)}
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-1">Amenities (description)</label>
                                <textarea
                                    className="w-full min-h-[100px] border rounded-md px-3 py-2 text-sm"
                                    placeholder="Describe your amenities (equipment, classes, locker rooms, parking, etc.)"
                                    value={amenitiesText}
                                    onChange={(e) => setAmenitiesText(e.target.value)}
                                />
                                    <div className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                                    Shown on your Search details card under “Amenities”.
                                </div>
                            </div>
                        </>
                    )}

                    {/* Uploaded Images */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium">Uploaded Images</label>
                            <div className="flex items-center gap-2">
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        const valid = files.filter(
                                            (f) => f.type.startsWith("image/") && f.size <= 8 * 1024 * 1024
                                        );
                                        onUpload(valid);
                                        if (fileRef.current) fileRef.current.value = "";
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className="px-3 py-1.5 rounded-full border bg-white text-sm hover:bg-gray-100 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                >
                                    Upload
                                </button>
                            </div>
                        </div>

                        {gallery.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">No images uploaded.</div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {gallery.map((u) => (
                                    <div key={u} className="relative group border rounded-lg overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={u} alt="" className="w-full h-32 object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => onRemove(u)}
                                            className="absolute top-1 right-1 text-[11px] px-2 py-0.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100"
                                            title="Remove"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onSave()}
                            disabled={saving}
                            className={clsx(
                                "px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50",
                                savedState === 'saved'
                                    ? "bg-green-600 text-white"
                                    : saving
                                        ? "bg-gray-300 text-gray-600"
                                        : "bg-gray-900 text-white hover:bg-green-700"
                            )}
                        >
                            {savedState === 'saved' ? 'Saved!' : savedState === 'saving' ? 'Saving…' : 'Save changes'}
                        </button>
                        {err && <span className="text-sm text-red-600">{err}</span>}
                    </div>
                </>
            )}
        </section>
    );
}
