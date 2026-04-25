// app/(main)/settings/page.tsx
'use client';

import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import PrivacyToggle from "./privacy-toggle";
import MobileHeader from "@/components/MobileHeader";
import SearchProfileEditor from "@/components/SearchProfileEditor";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { ChevronDown } from "lucide-react";

type LocationSuggestion = {
    id: string;
    label: string;
    city: string | null;
    state: string | null;
    country: string | null;
    lat: number;
    lng: number;
};

type GymSuggestion = {
    id: string;
    name: string;
    address?: string | null;
};

type TrainerSuggestion = {
    id: string;
    username: string | null;
    name: string | null;
};

export default function SettingsPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [profileSaveState, setProfileSaveState] = useState<"idle" | "saving" | "saved">("idle");
    const [profileError, setProfileError] = useState<string | null>(null);
    const [websiteToggleSaving, setWebsiteToggleSaving] = useState(false);
    const [accountEmail, setAccountEmail] = useState("");
    const [role, setRole] = useState("");
    const [showWebsiteButton, setShowWebsiteButton] = useState(false);
    const [website, setWebsite] = useState("");
    const [hiringTrainers, setHiringTrainers] = useState(false);
    const [traineeTrainerStatus, setTraineeTrainerStatus] = useState<"" | "LOOKING" | "TRAINING_WITH">("");
    const [traineeGymStatus, setTraineeGymStatus] = useState<"" | "LOOKING" | "MEMBER">("");
    const [trainerGymStatus, setTrainerGymStatus] = useState<"" | "LOOKING" | "TRAINER">("");
    const [associatedTrainer, setAssociatedTrainer] = useState<TrainerSuggestion | null>(null);
    const [associatedGym, setAssociatedGym] = useState<GymSuggestion | null>(null);
    const [trainerFieldInvalid, setTrainerFieldInvalid] = useState(false);
    const [gymFieldInvalid, setGymFieldInvalid] = useState(false);
    const [trainerGymFieldInvalid, setTrainerGymFieldInvalid] = useState(false);

    // Profile text fields
    const [name, setName] = useState("");
    const [location, setLocation] = useState(""); // display text label
    const [bio, setBio] = useState("");

    // NEW: structured location fields
    const [city, setCity] = useState("");
    const [stateRegion, setStateRegion] = useState("");
    const [country, setCountry] = useState("");
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);

    // Avatar
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const previousPreviewRef = useRef<string | null>(null);

    // Trigger to tell SearchProfileEditor to save
    const [searchSaveTrigger, setSearchSaveTrigger] = useState(0);

    // Delete account flow
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Password management
    const [hasPassword, setHasPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                let res: Response | null = null;

                for (let attempt = 0; attempt < 2; attempt += 1) {
                    res = await fetch("/api/user/profile", {
                        cache: "no-store",
                        credentials: "include",
                    });

                    if (res.ok || res.status === 404) {
                        break;
                    }

                    if (res.status === 401 && attempt === 0) {
                        await new Promise((resolve) => window.setTimeout(resolve, 500));
                        continue;
                    }

                    break;
                }

                if (!res) {
                    throw new Error("Unable to load settings");
                }

                if (!res.ok) {
                    if (res.status === 404) {
                        router.replace("/");
                        return;
                    }
                    if (res.status === 401) {
                        router.replace("/log-in");
                        return;
                    }
                    throw new Error("Unable to load settings");
                }

                const me = await res.json();
                if (cancelled) return;

                setName(me.name || "");
                setLocation(me.location || "");
                setBio(me.bio || "");
                setImageUrl(me.image || null);
                setHasPassword(Boolean(me.hasPassword));
                setAccountEmail(me.email || "");
                setRole(me.role || "");
                setShowWebsiteButton(Boolean(me.showWebsiteButton));
                setWebsite(me.website || "");
                setHiringTrainers(Boolean(me.hiringTrainers));
                setTraineeTrainerStatus(me.traineeTrainerStatus || "");
                setTraineeGymStatus(me.traineeGymStatus || "");
                setTrainerGymStatus(me.trainerGymStatus || "");
                setAssociatedTrainer(
                    me.associatedTrainer
                        ? {
                            id: me.associatedTrainer.id,
                            username: me.associatedTrainer.username,
                            name: me.associatedTrainer.name,
                        }
                        : null
                );
                setAssociatedGym(
                    me.traineeGymName || me.trainerGymName
                        ? {
                            id: me.traineeGymPlaceId || me.trainerGymPlaceId || me.traineeGymName || me.trainerGymName,
                            name: me.traineeGymName || me.trainerGymName,
                        }
                        : null
                );

                setCity(me.city || "");
                setStateRegion(me.state || "");
                setCountry(me.country || "");
                setLat(typeof me.lat === "number" ? me.lat : null);
                setLng(typeof me.lng === "number" ? me.lng : null);

                if (!me.location && (me.city || me.state || me.country)) {
                    const label = [me.city, me.state, me.country].filter(Boolean).join(", ");
                    setLocation(label);
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // Clean up blob URLs
    useEffect(() => {
        return () => {
            if (previousPreviewRef.current) {
                URL.revokeObjectURL(previousPreviewRef.current);
            }
        };
    }, []);

    const handleFilePick = (picked: File | null) => {
        setFile(picked);
        if (previousPreviewRef.current) {
            URL.revokeObjectURL(previousPreviewRef.current);
            previousPreviewRef.current = null;
        }
        if (picked) {
            const blobUrl = URL.createObjectURL(picked);
            setPreviewUrl(blobUrl);
            previousPreviewRef.current = blobUrl;
        } else {
            setPreviewUrl(null);
        }
    };

    // Save ONLY the main profile (name, location, bio, avatar)
    const saveProfile = async () => {
        try {
            const form = new FormData();
            form.append("name", name);
            form.append("location", location);
            form.append("bio", bio);

            // NEW: include structured fields for geocoding
            form.append("city", city);
            form.append("state", stateRegion);
            form.append("country", country);
            if (lat != null) form.append("lat", String(lat));
            if (lng != null) form.append("lng", String(lng));
            if (role === "GYM" || role === "TRAINER") {
                form.append("website", website);
                form.append("showWebsiteButton", String(showWebsiteButton));
            }
            if (role === "GYM") {
                form.append("hiringTrainers", String(hiringTrainers));
            }
            if (role === "TRAINEE") {
                form.append("traineeTrainerStatus", traineeTrainerStatus);
                form.append("traineeGymStatus", traineeGymStatus);
                form.append("associatedTrainerId", traineeTrainerStatus === "TRAINING_WITH" ? associatedTrainer?.id ?? "" : "");
                form.append("associatedGymName", traineeGymStatus === "MEMBER" ? associatedGym?.name ?? "" : "");
                form.append("associatedGymPlaceId", traineeGymStatus === "MEMBER" ? associatedGym?.id ?? "" : "");
            }
            if (role === "TRAINER") {
                form.append("trainerGymStatus", trainerGymStatus);
                form.append("associatedGymName", trainerGymStatus === "TRAINER" ? associatedGym?.name ?? "" : "");
                form.append("associatedGymPlaceId", trainerGymStatus === "TRAINER" ? associatedGym?.id ?? "" : "");
            }

            if (file) form.append("image", file);

            const res = await fetch("/api/user/profile", { method: "PATCH", body: form });
            if (!res.ok) throw new Error();
            const me = await res.json();

            setImageUrl(me.image || null);
            setTraineeTrainerStatus(me.traineeTrainerStatus || "");
            setTraineeGymStatus(me.traineeGymStatus || "");
            setTrainerGymStatus(me.trainerGymStatus || "");
            setAssociatedTrainer(
                me.associatedTrainer
                    ? {
                        id: me.associatedTrainer.id,
                        username: me.associatedTrainer.username,
                        name: me.associatedTrainer.name,
                    }
                    : null
            );
            setAssociatedGym(
                me.traineeGymName || me.trainerGymName
                    ? {
                        id:
                            me.traineeGymPlaceId ||
                            me.trainerGymPlaceId ||
                            me.traineeGymName ||
                            me.trainerGymName,
                        name: me.traineeGymName || me.trainerGymName,
                    }
                    : null
            );
            setWebsite(me.website || "");
            setHiringTrainers(Boolean(me.hiringTrainers));
            if (previousPreviewRef.current) {
                URL.revokeObjectURL(previousPreviewRef.current);
                previousPreviewRef.current = null;
            }
            setPreviewUrl(null);
            setFile(null);

        } catch {
            setProfileError("Failed to save profile.");
            throw new Error("Profile save failed");
        }
    };

    // Save BOTH main profile and search profile
    const saveBoth = async () => {
        if (profileSaveState === "saving") return;
        setProfileError(null);

        if (role === "TRAINEE" && traineeTrainerStatus === "TRAINING_WITH" && !associatedTrainer) {
            setTrainerFieldInvalid(true);
            window.setTimeout(() => setTrainerFieldInvalid(false), 1800);
            return;
        }

        if (role === "TRAINEE" && traineeGymStatus === "MEMBER" && !associatedGym) {
            setGymFieldInvalid(true);
            window.setTimeout(() => setGymFieldInvalid(false), 1800);
            return;
        }

        if (role === "TRAINER" && trainerGymStatus === "TRAINER" && !associatedGym) {
            setTrainerGymFieldInvalid(true);
            window.setTimeout(() => setTrainerGymFieldInvalid(false), 1800);
            return;
        }

        setProfileSaveState("saving");
        try {
            await saveProfile();
            setSearchSaveTrigger((t) => t + 1);
            setProfileSaveState("saved");
            setTimeout(() => setProfileSaveState("idle"), 2000);
        } catch {
            setProfileSaveState("idle");
        }
    };

    const handleWebsiteToggle = async () => {
        if (websiteToggleSaving) return;

        const nextValue = !showWebsiteButton;
        setShowWebsiteButton(nextValue);
        setWebsiteToggleSaving(true);
        setProfileError(null);

        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ showWebsiteButton: nextValue }),
            });

            if (!res.ok) {
                throw new Error("Failed to save website button setting.");
            }
        } catch (error) {
            console.error(error);
            setShowWebsiteButton(!nextValue);
            setProfileError("Failed to save website button setting.");
        } finally {
            setWebsiteToggleSaving(false);
        }
    };

    const handlePasswordUpdate = async () => {
        setPasswordError(null);
        setPasswordSuccess(null);

        if (newPassword.length < 8) {
            setPasswordError("New password must be at least 8 characters long.");
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setPasswordError("New password and confirmation must match.");
            return;
        }

        setPasswordLoading(true);
        try {
            const res = await fetch("/api/user/password", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: hasPassword ? currentPassword : undefined,
                    newPassword,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.message || "Failed to update password.");
            }
            setPasswordSuccess("Password saved.");
            setHasPassword(true);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
        } catch (err) {
            if (err instanceof Error) {
                setPasswordError(err.message);
            } else {
                setPasswordError("Failed to update password.");
            }
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!deletePassword) return;
        setDeleteLoading(true);
        setDeleteError(null);

        try {
            const res = await fetch("/api/user/delete", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ password: deletePassword }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.message || "Failed to delete account.");
            }

            setDeletePassword("");
            setShowDeleteConfirm(false);
            await signOut({ callbackUrl: "/" });
        } catch (err) {
            if (err instanceof Error) {
                setDeleteError(err.message);
            } else {
                setDeleteError("Failed to delete account.");
            }
        } finally {
            setDeleteLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-950">
                <span className="h-12 w-12 animate-spin rounded-full border-2 border-black border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
        );
    }

    const displayImage = previewUrl || imageUrl;

    return (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col dark:bg-[#050505] dark:text-gray-100">
            <MobileHeader title="settings" href="/settings" />

            <header className="hidden lg:flex w-full bg-white py-6 justify-start pl-[40px] z-20 dark:bg-neutral-900">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none dark:text-green-400">
                    <span>settings</span>
                </h1>
            </header>

            <main className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6 sm:px-6">
                {/* Profile + Privacy card */}
                <div className="bg-white rounded-xl shadow p-4 space-y-6 sm:p-6 dark:bg-neutral-900 dark:border dark:border-white/10 dark:shadow-none">
                    <section>
                        <h2 className="font-semibold mb-4">Profile</h2>

                        <div className="flex flex-col gap-6 items-start lg:flex-row">
                            {/* Avatar + upload */}
                            <div className="flex flex-col items-center gap-3 w-full lg:w-auto">
                                <div className="w-32 h-32 rounded-full bg-gray-100 border flex items-center justify-center overflow-hidden dark:bg-neutral-800 dark:border-white/10">
                                    {displayImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={displayImage} alt="avatar preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-gray-400 text-sm dark:text-gray-500">No image</span>
                                    )}
                                </div>

                                <label
                                    htmlFor="avatar-file"
                                    className="inline-flex items-center px-3 py-1.5 rounded-full border bg-white text-sm hover:bg-gray-100 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                >
                                    Choose image
                                </label>
                                <input
                                    id="avatar-file"
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                                />

                                <div className="text-xs text-gray-500 min-h-[1rem] dark:text-gray-400">
                                    {file ? file.name : previewUrl ? "Previewing selected image" : ""}
                                </div>

                                {previewUrl && (
                                    <div className="text-[11px] text-gray-500 text-center max-w-[10rem] dark:text-gray-400">
                                        This is a preview. Click <span className="font-medium">Save changes</span> to apply.
                                    </div>
                                )}
                            </div>

                            {/* Fields */}
                            <div className="w-full space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Name</label>
                                    <input
                                        className="w-full border rounded px-3 py-2 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Location</label>
                                    <LocationAutocomplete
                                        label={location}
                                        onChangeLabel={setLocation}
                                        onChangeStructured={(loc) => {
                                            setLocation(loc.label);
                                            setCity(loc.city || "");
                                            setStateRegion(loc.state || "");
                                            setCountry(loc.country || "");
                                            setLat(loc.lat);
                                            setLng(loc.lng);
                                        }}
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Start typing a city (e.g. “Cincinnati, OH”) and choose a suggestion.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Bio</label>
                                    <textarea
                                        className="w-full border rounded px-3 py-2 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                        rows={4}
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                    />
                                </div>

                                {role === "TRAINEE" && (
                                    <div className="grid gap-4 md:grid-cols-2 md:items-start">
                                        <div className="space-y-2">
                                            <label className="block text-sm text-gray-600 dark:text-gray-300">Trainer status</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full appearance-none border rounded px-3 py-2 pr-12 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                                    value={traineeTrainerStatus}
                                                    onChange={(e) => {
                                                        const next = e.target.value as "" | "LOOKING" | "TRAINING_WITH";
                                                        setTraineeTrainerStatus(next);
                                                        setTrainerFieldInvalid(false);
                                                        if (next !== "TRAINING_WITH") {
                                                            setAssociatedTrainer(null);
                                                        }
                                                    }}
                                                >
                                                    <option value=""></option>
                                                    <option value="LOOKING">I'm looking for a trainer</option>
                                                    <option value="TRAINING_WITH">I have a trainer</option>
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                                            </div>
                                            {traineeTrainerStatus === "TRAINING_WITH" && (
                                                <TrainerAutocomplete
                                                    value={associatedTrainer}
                                                    onChange={(trainer) => {
                                                        setAssociatedTrainer(trainer);
                                                        if (trainer) {
                                                            setTrainerFieldInvalid(false);
                                                        }
                                                    }}
                                                    invalid={trainerFieldInvalid}
                                                />
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm text-gray-600 dark:text-gray-300">Gym status</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full appearance-none border rounded px-3 py-2 pr-12 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                                    value={traineeGymStatus}
                                                    onChange={(e) => {
                                                        const next = e.target.value as "" | "LOOKING" | "MEMBER";
                                                        setTraineeGymStatus(next);
                                                        setGymFieldInvalid(false);
                                                        if (next !== "MEMBER") {
                                                            setAssociatedGym(null);
                                                        }
                                                    }}
                                                >
                                                    <option value=""></option>
                                                    <option value="LOOKING">I'm looking for a gym</option>
                                                    <option value="MEMBER">I'm a member at a gym</option>
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                                            </div>
                                            {traineeGymStatus === "MEMBER" && (
                                                <GymAutocomplete
                                                    value={associatedGym}
                                                    onChange={(gym) => {
                                                        setAssociatedGym(gym);
                                                        if (gym) {
                                                            setGymFieldInvalid(false);
                                                        }
                                                    }}
                                                    invalid={gymFieldInvalid}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {role === "TRAINER" && (
                                    <div className="space-y-2">
                                        <label className="block text-sm text-gray-600 dark:text-gray-300">Gym status</label>
                                        <div className="relative">
                                            <select
                                                className="w-full appearance-none border rounded px-3 py-2 pr-12 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                                value={trainerGymStatus}
                                                onChange={(e) => {
                                                    const next = e.target.value as "" | "LOOKING" | "TRAINER";
                                                    setTrainerGymStatus(next);
                                                    setTrainerGymFieldInvalid(false);
                                                    if (next !== "TRAINER") {
                                                        setAssociatedGym(null);
                                                    }
                                                }}
                                            >
                                                <option value=""></option>
                                                <option value="LOOKING">I'm looking for a gym</option>
                                                <option value="TRAINER">I'm a trainer at a gym</option>
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                                        </div>
                                        {trainerGymStatus === "TRAINER" && (
                                            <GymAutocomplete
                                                value={associatedGym}
                                                onChange={(gym) => {
                                                    setAssociatedGym(gym);
                                                    if (gym) {
                                                        setTrainerGymFieldInvalid(false);
                                                    }
                                                }}
                                                invalid={trainerGymFieldInvalid}
                                            />
                                        )}
                                    </div>
                                )}

                                {(role === "GYM" || role === "TRAINER") && (
                                    <div className="space-y-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-white/10">
                                        <div className="flex items-center justify-between">
                                            <div className="pr-4">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Show website button on profile</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Display a website link icon on your profile next to the profile actions.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={showWebsiteButton}
                                                onClick={handleWebsiteToggle}
                                                disabled={websiteToggleSaving}
                                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                                                    showWebsiteButton ? "bg-green-600" : "bg-gray-300 dark:bg-neutral-700"
                                                } ${websiteToggleSaving ? "cursor-not-allowed opacity-60" : ""}`}
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
                                                    className="w-full border rounded px-3 py-2 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                                    value={website}
                                                    onChange={(e) => setWebsite(e.target.value)}
                                                    placeholder="https://example.com"
                                                    autoCapitalize="off"
                                                    autoCorrect="off"
                                                    spellCheck={false}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {role === "GYM" && (
                                    <div className="space-y-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-white/10">
                                        <div className="flex items-center justify-between">
                                            <div className="pr-4">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Hiring trainers?</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Display “Hiring trainers” on your profile.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={hiringTrainers}
                                                onClick={() => setHiringTrainers((current) => !current)}
                                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                                                    hiringTrainers ? "bg-green-600" : "bg-gray-300 dark:bg-neutral-700"
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                                        hiringTrainers ? "translate-x-5" : "translate-x-1"
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 flex-wrap">
                                    <button
                                        onClick={saveBoth}
                                        disabled={profileSaveState === "saving"}
                                        className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50 hover:bg-green-700"
                                    >
                                        {profileSaveState === "saved"
                                            ? "Saved!"
                                            : profileSaveState === "saving"
                                                ? "Saving…"
                                                : "Save changes"}
                                    </button>
                                    {profileError && (
                                        <span className="text-sm text-red-600">{profileError}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="font-semibold mb-2">Privacy</h2>
                        <PrivacyToggle />
                    </section>
                </div>

                {/* Search Profile card */}
                <div className="bg-white rounded-xl shadow p-4 space-y-6 sm:p-6 dark:bg-neutral-900 dark:border dark:border-white/10 dark:shadow-none">
                    <SearchProfileEditor externalSaveTrigger={searchSaveTrigger} />
                </div>

                {/* Password management */}
                <div className="bg-white rounded-xl shadow p-4 space-y-4 sm:p-6 dark:bg-neutral-900 dark:border dark:border-white/10 dark:shadow-none">
                    <h2 className="font-semibold">Password</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {hasPassword
                            ? "Update your password below."
                            : "Create a password so you can log in without Google."}
                    </p>
                    {hasPassword && (
                        <div>
                            <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Current password</label>
                            <PasswordInput
                                className="w-full border rounded px-3 py-2 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                disabled={passwordLoading}
                                placeholder="Enter current password"
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">New password</label>
                        <PasswordInput
                            className="w-full border rounded px-3 py-2 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={passwordLoading}
                            placeholder="At least 8 characters"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Confirm new password</label>
                        <PasswordInput
                            className="w-full border rounded px-3 py-2 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            disabled={passwordLoading}
                        />
                    </div>
                    {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                    {passwordSuccess && <p className="text-sm text-green-600">{passwordSuccess}</p>}
                    <button
                        type="button"
                        onClick={handlePasswordUpdate}
                        disabled={
                            passwordLoading ||
                            newPassword.length === 0 ||
                            confirmNewPassword.length === 0 ||
                            (hasPassword && currentPassword.length === 0)
                        }
                        className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-600 dark:text-white dark:hover:bg-green-700"
                    >
                        {passwordLoading ? "Saving…" : hasPassword ? "Update Password" : "Create Password"}
                    </button>
                </div>

                {/* Log Out */}
                <div className="bg-white rounded-xl shadow p-6 dark:bg-neutral-900 dark:border dark:border-white/10 dark:shadow-none">
                    <h2 className="font-semibold mb-3">Log Out</h2>
                        <p className="text-sm text-gray-600 mb-4 dark:text-gray-300">
                            You are currently signed in as{" "}
                            <span className="font-medium">
                                {accountEmail || session?.user?.email || session?.user?.name || "your account"}
                            </span>.
                        </p>
                    <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                        aria-label="Log out"
                    >
                        Log Out
                    </button>

                    <div className="mt-6 border-t border-gray-200 pt-6 dark:border-white/10">
                        <h3 className="font-semibold mb-3">Delete Account</h3>
                        <p className="text-sm text-gray-600 mb-4 dark:text-gray-300">
                            Permanently remove your account and data. This action cannot be undone.
                        </p>
                        {showDeleteConfirm ? (
                            <div className="space-y-3">
                                <label htmlFor="delete-password" className="block text-sm text-gray-700 dark:text-gray-300">
                                    Confirm password
                                </label>
                                <PasswordInput
                                    id="delete-password"
                                    className="w-full border rounded px-3 py-2 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    disabled={deleteLoading}
                                />
                                {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={!deletePassword || deleteLoading}
                                        className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50"
                                    >
                                        {deleteLoading ? "Deleting…" : "Delete my account"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setDeletePassword("");
                                            setDeleteError(null);
                                        }}
                                        className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:border-white/10 dark:hover:bg-white/10"
                                        disabled={deleteLoading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(true);
                                    setDeleteError(null);
                                }}
                                    className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                            >
                                Delete Account
                            </button>
                        )}
                    </div>
                </div>
            </main>

        </div>
    );
}

/**
 * LocationAutocomplete
 * - Debounces calls to /api/location-search (Open-Meteo)
 * - Shows dropdown of city suggestions
 * - On select: returns label + city/state/country + lat/lng
 */
function LocationAutocomplete({
    label,
    onChangeLabel,
    onChangeStructured,
}: {
    label: string;
    onChangeLabel: (value: string) => void;
    onChangeStructured: (loc: {
        label: string;
        city: string | null;
        state: string | null;
        country: string | null;
        lat: number;
        lng: number;
    }) => void;
}) {
    const [input, setInput] = useState(label || "");
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);

    // keep input in sync with external label changes
    useEffect(() => {
        setInput(label || "");
    }, [label]);

    // debounced search to /api/location-search
    useEffect(() => {
        if (!input || input.length < 2) {
            setSuggestions([]);
            return;
        }

        const handle = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/location-search?q=${encodeURIComponent(input)}`);
                if (!res.ok) throw new Error();
                const json = await res.json();
                setSuggestions(json.results || []);
                setOpen((json.results || []).length > 0);
            } catch {
                setSuggestions([]);
                setOpen(false);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(handle);
    }, [input]);

    const handleSelect = (s: LocationSuggestion) => {
        onChangeStructured({
            label: s.label,
            city: s.city,
            state: s.state,
            country: s.country,
            lat: s.lat,
            lng: s.lng,
        });
        setInput(s.label);
        setOpen(false);
    };

    return (
        <div className="relative">
            <input
                className="w-full border rounded px-3 py-2 dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                value={input}
                onChange={(e) => {
                    setInput(e.target.value);
                    onChangeLabel(e.target.value);
                }}
                onFocus={() => {
                    if (suggestions.length) setOpen(true);
                }}
                placeholder="Start typing a city…"
            />
            {loading && (
                <div className="absolute right-3 top-2.5 text-xs text-gray-400 dark:text-gray-500">
                    …
                </div>
            )}

            {open && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow max-h-60 overflow-y-auto dark:bg-neutral-900 dark:border-white/10 dark:text-gray-100">
                    {suggestions.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/10"
                            onClick={() => handleSelect(s)}
                        >
                            <div className="font-medium">{s.label}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {[s.city, s.state, s.country].filter(Boolean).join(", ")}
                            </div>
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
                setError(null);
            } catch (err) {
                setSuggestions([]);
                setOpen(false);
                setError(err instanceof Error ? err.message : "Unable to search gyms.");
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => clearTimeout(handle);
    }, [input]);

    return (
        <div className="relative">
            <input
                className={`w-full border rounded px-3 py-2 dark:bg-transparent dark:text-gray-100 ${
                    invalid
                        ? "border-red-500 dark:border-red-500"
                        : "dark:border-white/10"
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
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Search Google Places and pick the gym name you want shown on your profile.
            </p>
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
    }, [input]);

    return (
        <div className="relative">
            <input
                className={`w-full border rounded px-3 py-2 dark:bg-transparent dark:text-gray-100 ${
                    invalid
                        ? "border-red-500 dark:border-red-500"
                        : "dark:border-white/10"
                }`}
                value={input}
                onChange={(e) => {
                    const next = e.target.value;
                    setInput(next);
                    const selectedValue = value?.username ?? value?.name ?? "";
                    if (value && next !== selectedValue) {
                        onChange(null);
                    }
                }}
                onFocus={() => {
                    if (suggestions.length) setOpen(true);
                }}
                onBlur={() => {
                    window.setTimeout(() => setOpen(false), 150);
                }}
                placeholder="Search trainers by username"
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
                            <div className="text-sm font-medium dark:text-gray-100">{trainer.username ?? trainer.name ?? "Trainer"}</div>
                            {trainer.name && trainer.username && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{trainer.name}</div>
                            )}
                        </button>
                    ))}
                </div>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Pick a trainer account to display on your profile.
            </p>
        </div>
    );
}
