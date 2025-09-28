'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type Role = "TRAINEE" | "TRAINER" | "GYM" | null;

export default function SearchProfileEditor() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

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
    const [newGoal, setNewGoal] = useState("");
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

    const onSave = async () => {
        try {
            setSaving(true);
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
            setSaving(false);
        }
    };

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

    return (
        <section className="mt-6">
            <h2 className="text-xl font-semibold mb-2">Search Profile</h2>
            <p className="text-sm text-gray-600 mb-5">
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
                            className="w-full min-h-[100px] border rounded-md px-3 py-2 text-sm"
                            placeholder="Tell people about yourself…"
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                        />
                        <div className="text-xs text-gray-500 mt-1">Shown on your Search details card.</div>
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
                                            "px-3 py-1 rounded-full border text-sm",
                                            goals.includes(g) ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50"
                                        )}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>

                            {/* Current selected chips with remove */}
                            {goals.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {goals.map((g) => (
                                        <span key={g} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs bg-gray-50">
                                            {g}
                                            <button
                                                type="button"
                                                className="text-gray-500 hover:text-black"
                                                onClick={() => setGoals(goals.filter((x) => x !== g))}
                                                title="Remove"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Add custom goal */}
                            <div className="flex items-center gap-2 max-w-md">
                                <input
                                    className="flex-1 border rounded px-3 py-2 text-sm"
                                    placeholder="Add a custom goal and press Enter…"
                                    value={newGoal}
                                    onChange={(e) => setNewGoal(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            addCustom(newGoal, goals, setGoals, () => setNewGoal(""));
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => addCustom(newGoal, goals, setGoals, () => setNewGoal(""))}
                                    className="px-3 py-1.5 rounded-full border bg-white text-sm hover:bg-gray-50"
                                >
                                    Add
                                </button>
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
                                                "px-3 py-1 rounded-full border text-sm",
                                                services.includes(s) ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50"
                                            )}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>

                                {/* Current selected chips with remove */}
                                {services.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {services.map((s) => (
                                            <span key={s} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs bg-gray-50">
                                                {s}
                                                <button
                                                    type="button"
                                                    className="text-gray-500 hover:text-black"
                                                    onClick={() => setServices(services.filter((x) => x !== s))}
                                                    title="Remove"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Add custom service */}
                                <div className="flex items-center gap-2 max-w-md">
                                    <input
                                        className="flex-1 border rounded px-3 py-2 text-sm"
                                        placeholder="Add a custom service and press Enter…"
                                        value={newService}
                                        onChange={(e) => setNewService(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                addCustom(newService, services, setServices, () => setNewService(""));
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => addCustom(newService, services, setServices, () => setNewService(""))}
                                        className="px-3 py-1.5 rounded-full border bg-white text-sm hover:bg-gray-50"
                                    >
                                        Add
                                    </button>
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
                                <label className="block text-sm font-medium mb-1">Membership fee ($/mo)</label>
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
                                <div className="text-xs text-gray-500 mt-1">
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
                                    className="px-3 py-1.5 rounded-full border bg-white text-sm hover:bg-gray-50"
                                >
                                    Upload
                                </button>
                            </div>
                        </div>

                        {gallery.length === 0 ? (
                            <div className="text-sm text-gray-500">No images uploaded.</div>
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
                            onClick={onSave}
                            disabled={saving}
                            className={clsx(
                                "px-4 py-2 rounded-full text-sm",
                                saving ? "bg-gray-300 text-gray-600" : "bg-gray-900 text-white hover:bg-black"
                            )}
                        >
                            {saving ? "Saving…" : "Save changes"}
                        </button>
                        {err && <span className="text-sm text-red-600">{err}</span>}
                    </div>
                </>
            )}
        </section>
    );
}
