// app/(main)/settings/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import PrivacyToggle from "./privacy-toggle";
import MobileHeader from "@/components/MobileHeader";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { genUploader } from "uploadthing/client";

import type { UploadRouter } from "@/app/api/uploadthing/core";

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

type AddressSuggestion = {
    id: string;
    label: string;
};

type TrainerSuggestion = {
    id: string;
    username: string | null;
    name: string | null;
};

type SettingsProfileSnapshot = {
    role: string;
    name: string;
    location: string;
    bio: string;
    city: string;
    stateRegion: string;
    country: string;
    lat: number | null;
    lng: number | null;
    showWebsiteButton: boolean;
    website: string;
    hiringTrainers: boolean;
    gymProfileName: string;
    gymProfileAddress: string;
    gymProfilePhone: string;
    gymProfileFee: string;
    traineeTrainerStatus: "" | "LOOKING" | "TRAINING_WITH";
    traineeGymStatus: "" | "LOOKING" | "MEMBER";
    trainerGymStatus: "" | "LOOKING" | "TRAINER";
    associatedTrainerId: string;
    associatedGymId: string;
    associatedGymName: string;
    imageUrl: string | null;
    hasPendingImage: boolean;
};

const { uploadFiles } = genUploader<UploadRouter>();

function formatPhoneNumber(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);

    if (digits.length === 0) return "";
    if (digits.length < 4) return `(${digits}`;
    if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatCurrencyInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (!digits) return "0.00";

    const cents = Number(digits);
    return (cents / 100).toFixed(2);
}

function formatCurrencyValue(value: number) {
    return value.toFixed(2);
}

export default function SettingsPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [profileSaveState, setProfileSaveState] = useState<"idle" | "saving" | "saved">("idle");
    const [profileError, setProfileError] = useState<string | null>(null);
    const [accountEmail, setAccountEmail] = useState("");
    const [role, setRole] = useState("");
    const [showWebsiteButton, setShowWebsiteButton] = useState(false);
    const [website, setWebsite] = useState("");
    const [hiringTrainers, setHiringTrainers] = useState(false);
    const [gymProfileName, setGymProfileName] = useState("");
    const [gymProfileAddress, setGymProfileAddress] = useState("");
    const [gymProfilePhone, setGymProfilePhone] = useState("");
    const [gymProfileFee, setGymProfileFee] = useState("");
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

    // Delete account flow
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [initialProfileSnapshot, setInitialProfileSnapshot] = useState<SettingsProfileSnapshot | null>(null);

    const primaryActionButtonClass =
        "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 bg-green-700 text-white hover:bg-green-800 dark:bg-green-500 dark:text-black dark:hover:bg-green-400";
    const mutedActionButtonClass =
        "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15";
    const disabledActionButtonClass =
        "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 bg-gray-300 text-gray-600 dark:bg-white/10 dark:text-gray-400";
    const dangerActionButtonClass =
        "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:text-white dark:hover:bg-red-400";

    // Password management
    const [hasPassword, setHasPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

    const currentProfileSnapshot = useMemo<SettingsProfileSnapshot>(
        () => ({
            role,
            name,
            location,
            bio,
            city,
            stateRegion,
            country,
            lat,
            lng,
            showWebsiteButton,
            website,
            hiringTrainers,
            gymProfileName,
            gymProfileAddress,
            gymProfilePhone,
            gymProfileFee,
            traineeTrainerStatus,
            traineeGymStatus,
            trainerGymStatus,
            associatedTrainerId: associatedTrainer?.id ?? "",
            associatedGymId: associatedGym?.id ?? "",
            associatedGymName: associatedGym?.name ?? "",
            imageUrl,
            hasPendingImage: Boolean(file),
        }),
        [
            role,
            name,
            location,
            bio,
            city,
            stateRegion,
            country,
            lat,
            lng,
            showWebsiteButton,
            website,
            hiringTrainers,
            gymProfileName,
            gymProfileAddress,
            gymProfilePhone,
            gymProfileFee,
            traineeTrainerStatus,
            traineeGymStatus,
            trainerGymStatus,
            associatedTrainer,
            associatedGym,
            imageUrl,
            file,
        ]
    );

    const isProfileDirty = useMemo(() => {
        if (!initialProfileSnapshot) return false;
        return JSON.stringify(currentProfileSnapshot) !== JSON.stringify(initialProfileSnapshot);
    }, [currentProfileSnapshot, initialProfileSnapshot]);

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
                setGymProfileName(me.gymProfileName || "");
                setGymProfileAddress(me.gymProfileAddress || "");
                setGymProfilePhone(me.gymProfilePhone || "");
                setGymProfileFee(
                    typeof me.gymProfileFee === "number" && !Number.isNaN(me.gymProfileFee)
                        ? formatCurrencyValue(me.gymProfileFee)
                        : ""
                );
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

                setInitialProfileSnapshot({
                    role: me.role || "",
                    name: me.name || "",
                    location: me.location || "",
                    bio: me.bio || "",
                    city: me.city || "",
                    stateRegion: me.state || "",
                    country: me.country || "",
                    lat: typeof me.lat === "number" ? me.lat : null,
                    lng: typeof me.lng === "number" ? me.lng : null,
                    showWebsiteButton: Boolean(me.showWebsiteButton),
                    website: me.website || "",
                    hiringTrainers: Boolean(me.hiringTrainers),
                    gymProfileName: me.gymProfileName || "",
                    gymProfileAddress: me.gymProfileAddress || "",
                    gymProfilePhone: me.gymProfilePhone || "",
                    gymProfileFee:
                        typeof me.gymProfileFee === "number" && !Number.isNaN(me.gymProfileFee)
                            ? formatCurrencyValue(me.gymProfileFee)
                            : "",
                    traineeTrainerStatus: me.traineeTrainerStatus || "",
                    traineeGymStatus: me.traineeGymStatus || "",
                    trainerGymStatus: me.trainerGymStatus || "",
                    associatedTrainerId: me.associatedTrainer?.id || "",
                    associatedGymId:
                        me.traineeGymPlaceId ||
                        me.trainerGymPlaceId ||
                        me.traineeGymName ||
                        me.trainerGymName ||
                        "",
                    associatedGymName: me.traineeGymName || me.trainerGymName || "",
                    imageUrl: me.image || null,
                    hasPendingImage: false,
                });
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
            form.append("bio", bio);

            if (role !== "GYM") {
                form.append("name", name);
                form.append("location", location);
                form.append("city", city);
                form.append("state", stateRegion);
                form.append("country", country);
                if (lat != null) form.append("lat", String(lat));
                if (lng != null) form.append("lng", String(lng));
            }
            if (role === "GYM" || role === "TRAINER") {
                form.append("website", website);
                form.append("showWebsiteButton", String(showWebsiteButton));
            }
            if (role === "GYM") {
                form.append("hiringTrainers", String(hiringTrainers));
                form.append("gymProfileName", gymProfileName);
                form.append("gymProfileAddress", gymProfileAddress);
                form.append("gymProfilePhone", gymProfilePhone);
                form.append("gymProfileFee", gymProfileFee);
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

            if (file) {
                const uploadedFiles = await uploadFiles("postMedia", {
                    files: [file],
                });
                const imageUrl = uploadedFiles
                    .map((uploadedFile) => uploadedFile.serverData?.url || uploadedFile.ufsUrl)
                    .find(Boolean);

                if (!imageUrl) {
                    throw new Error("Image upload failed");
                }

                form.append("imageUrl", imageUrl);
            }

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
            setGymProfileName(me.gymProfileName || "");
            setGymProfileAddress(me.gymProfileAddress || "");
            setGymProfilePhone(me.gymProfilePhone || "");
            setGymProfileFee(
                typeof me.gymProfileFee === "number" && !Number.isNaN(me.gymProfileFee)
                    ? formatCurrencyValue(me.gymProfileFee)
                    : ""
            );
            if (previousPreviewRef.current) {
                URL.revokeObjectURL(previousPreviewRef.current);
                previousPreviewRef.current = null;
            }
            setPreviewUrl(null);
            setFile(null);
            setInitialProfileSnapshot({
                role: me.role || role,
                name: me.name || "",
                location: me.location || "",
                bio: me.bio || "",
                city: me.city || "",
                stateRegion: me.state || "",
                country: me.country || "",
                lat: typeof me.lat === "number" ? me.lat : null,
                lng: typeof me.lng === "number" ? me.lng : null,
                showWebsiteButton: Boolean(me.showWebsiteButton),
                website: me.website || "",
                hiringTrainers: Boolean(me.hiringTrainers),
                gymProfileName: me.gymProfileName || "",
                gymProfileAddress: me.gymProfileAddress || "",
                gymProfilePhone: me.gymProfilePhone || "",
                gymProfileFee:
                    typeof me.gymProfileFee === "number" && !Number.isNaN(me.gymProfileFee)
                        ? formatCurrencyValue(me.gymProfileFee)
                        : "",
                traineeTrainerStatus: me.traineeTrainerStatus || "",
                traineeGymStatus: me.traineeGymStatus || "",
                trainerGymStatus: me.trainerGymStatus || "",
                associatedTrainerId: me.associatedTrainer?.id || "",
                associatedGymId:
                    me.traineeGymPlaceId ||
                    me.trainerGymPlaceId ||
                    me.traineeGymName ||
                    me.trainerGymName ||
                    "",
                associatedGymName: me.traineeGymName || me.trainerGymName || "",
                imageUrl: me.image || null,
                hasPendingImage: false,
            });

        } catch {
            setProfileError("Failed to save profile.");
            throw new Error("Profile save failed");
        }
    };

    const saveSettings = async () => {
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
            setProfileSaveState("saved");
            setTimeout(() => setProfileSaveState("idle"), 2000);
        } catch {
            setProfileSaveState("idle");
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
                                {role !== "GYM" ? (
                                    <>
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Name</label>
                                            <input
                                                className="w-full border rounded px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
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
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Name</label>
                                            <input
                                                className="w-full border rounded px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                                value={gymProfileName}
                                                onChange={(e) => setGymProfileName(e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Address</label>
                                            <AddressAutocomplete
                                                label={gymProfileAddress}
                                                onChangeLabel={setGymProfileAddress}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Phone number</label>
                                            <input
                                                className="w-full border rounded px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                                value={gymProfilePhone}
                                                onChange={(e) => setGymProfilePhone(formatPhoneNumber(e.target.value))}
                                                placeholder="(123) 456-7890"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Monthly membership fee</label>
                                            <div className="relative">
                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                                    $
                                                </span>
                                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                                                    /month
                                                </span>
                                                <input
                                                    inputMode="decimal"
                                                    className="w-full border rounded py-2 pl-8 pr-16 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                                    value={gymProfileFee}
                                                    onChange={(e) => setGymProfileFee(formatCurrencyInput(e.target.value))}
                                                    onBlur={() => {
                                                        if (!gymProfileFee) {
                                                            setGymProfileFee("0.00");
                                                            return;
                                                        }
                                                        const parsed = Number(gymProfileFee);
                                                        if (Number.isFinite(parsed)) {
                                                            setGymProfileFee(parsed.toFixed(2));
                                                        }
                                                    }}
                                                    placeholder="99.99"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Bio</label>
                                    <textarea
                                        className="w-full border rounded px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                        rows={4}
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                    />
                                </div>

                                {role === "TRAINEE" && (
                                    <div className="grid gap-4 md:grid-cols-2 md:items-start">
                                        <div className="space-y-2">
                                            <label className="block text-sm text-gray-600 dark:text-gray-300">Trainer status</label>
                                        <div className="flex flex-nowrap gap-1.5 sm:flex-wrap sm:gap-2">
                                            {[
                                                { value: "LOOKING" as const, label: "I'm looking for a trainer" },
                                                { value: "TRAINING_WITH" as const, label: "I have a trainer" },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        const next = traineeTrainerStatus === option.value ? "" : option.value;
                                                        setTraineeTrainerStatus(next);
                                                        setTrainerFieldInvalid(false);
                                                        if (next !== "TRAINING_WITH") {
                                                            setAssociatedTrainer(null);
                                                        }
                                                    }}
                                                    className={`rounded-full border px-3 py-2 text-xs font-medium leading-none transition-colors sm:px-3.5 sm:py-1.5 sm:text-[13px] ${
                                                        traineeTrainerStatus === option.value
                                                            ? "border-green-700 bg-green-700 text-white hover:bg-green-800 dark:border-green-500 dark:bg-green-500 dark:text-black dark:hover:border-green-400 dark:hover:bg-green-400"
                                                            : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                                                    }`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
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
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: "LOOKING" as const, label: "I'm looking for a gym" },
                                                { value: "MEMBER" as const, label: "I'm a member at a gym" },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        const next = traineeGymStatus === option.value ? "" : option.value;
                                                        setTraineeGymStatus(next);
                                                        setGymFieldInvalid(false);
                                                        if (next !== "MEMBER") {
                                                            setAssociatedGym(null);
                                                        }
                                                    }}
                                                    className={`rounded-full border px-3 py-2 text-xs font-medium leading-none transition-colors sm:px-3.5 sm:py-1.5 sm:text-[13px] ${
                                                        traineeGymStatus === option.value
                                                            ? "border-green-700 bg-green-700 text-white hover:bg-green-800 dark:border-green-500 dark:bg-green-500 dark:text-black dark:hover:border-green-400 dark:hover:bg-green-400"
                                                            : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                                                    }`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
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
                                        <div className="flex flex-nowrap gap-2">
                                            {[
                                                { value: "LOOKING" as const, label: "I'm looking for a gym" },
                                                { value: "TRAINER" as const, label: "I'm a trainer at a gym" },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        const next = trainerGymStatus === option.value ? "" : option.value;
                                                        setTrainerGymStatus(next);
                                                        setTrainerGymFieldInvalid(false);
                                                        if (next !== "TRAINER") {
                                                            setAssociatedGym(null);
                                                        }
                                                    }}
                                                    className={`min-w-0 flex-1 rounded-full border px-3 py-2 text-xs font-medium leading-none transition-colors sm:flex-none sm:px-3.5 sm:py-1.5 sm:text-[13px] ${
                                                        trainerGymStatus === option.value
                                                            ? "border-green-700 bg-green-700 text-white hover:bg-green-800 dark:border-green-500 dark:bg-green-500 dark:text-black dark:hover:border-green-400 dark:hover:bg-green-400"
                                                            : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                                                    }`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
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
                                        <div className="flex flex-nowrap items-center justify-between gap-3">
                                            <div className="min-w-0 flex-1 pr-2">
                                                <p className="whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">Show website on profile</p>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={showWebsiteButton}
                                                onClick={() => setShowWebsiteButton((current) => !current)}
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
                                                    onChange={(e) => setWebsite(e.target.value)}
                                                    placeholder="https://example.com"
                                                    autoCapitalize="off"
                                                    autoCorrect="off"
                                                    spellCheck={false}
                                                />
                                            </div>
                                        )}

                                        {role === "GYM" && (
                                            <div className="flex flex-nowrap items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1 pr-2">
                                                    <p className="whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">Actively hiring trainers</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={hiringTrainers}
                                                    onClick={() => setHiringTrainers((current) => !current)}
                                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                                                        hiringTrainers ? "bg-green-700 dark:bg-green-500" : "bg-gray-300 dark:bg-neutral-700"
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                                            hiringTrainers ? "translate-x-5" : "translate-x-1"
                                                        }`}
                                                    />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                                    <button
                                        onClick={saveSettings}
                                        disabled={profileSaveState === "saving" || (!isProfileDirty && profileSaveState === "idle")}
                                        className={
                                            `${profileSaveState === "saving"
                                                ? disabledActionButtonClass
                                                : profileSaveState === "saved" || isProfileDirty
                                                    ? primaryActionButtonClass
                                                    : mutedActionButtonClass} w-full sm:w-auto`
                                        }
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
                                className="w-full border rounded px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
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
                            className="w-full border rounded px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={passwordLoading}
                            placeholder="At least 8 characters"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1 dark:text-gray-300">Confirm new password</label>
                        <PasswordInput
                            className="w-full border rounded px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            disabled={passwordLoading}
                        />
                    </div>
                    {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                    {passwordSuccess && <p className="text-sm text-green-700 dark:text-green-400">{passwordSuccess}</p>}
                    <button
                        type="button"
                        onClick={handlePasswordUpdate}
                        disabled={
                            passwordLoading ||
                            newPassword.length === 0 ||
                            confirmNewPassword.length === 0 ||
                            (hasPassword && currentPassword.length === 0)
                        }
                        className={
                            passwordLoading ||
                            newPassword.length === 0 ||
                            confirmNewPassword.length === 0 ||
                            (hasPassword && currentPassword.length === 0)
                                ? disabledActionButtonClass
                                : primaryActionButtonClass
                        }
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
                        className={dangerActionButtonClass}
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
                                    className="w-full border rounded px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    disabled={deleteLoading}
                                />
                                {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={!deletePassword || deleteLoading}
                                        className={!deletePassword || deleteLoading ? disabledActionButtonClass : dangerActionButtonClass}
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
                                        className={mutedActionButtonClass}
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
                                className={dangerActionButtonClass}
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
                className="w-full border rounded px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
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

function AddressAutocomplete({
    label,
    onChangeLabel,
}: {
    label: string;
    onChangeLabel: (value: string) => void;
}) {
    const [input, setInput] = useState(label || "");
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState(label || "");

    useEffect(() => {
        setInput(label || "");
        setSelectedLabel(label || "");
    }, [label]);

    useEffect(() => {
        if (selectedLabel && input === selectedLabel) {
            setSuggestions([]);
            setOpen(false);
            setLoading(false);
            return;
        }

        if (!input || input.length < 3) {
            setSuggestions([]);
            setOpen(false);
            return;
        }

        const handle = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/address-search?q=${encodeURIComponent(input)}`);
                if (!res.ok) throw new Error();
                const json = await res.json();
                const results = json.results || [];
                setSuggestions(results);
                setOpen(results.length > 0);
            } catch {
                setSuggestions([]);
                setOpen(false);
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => clearTimeout(handle);
    }, [input]);

    const handleSelect = (suggestion: AddressSuggestion) => {
        setInput(suggestion.label);
        setSelectedLabel(suggestion.label);
        onChangeLabel(suggestion.label);
        setSuggestions([]);
        setOpen(false);
    };

    return (
        <div className="relative">
            <input
                className="w-full border rounded px-3 py-2 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:border-white/10 dark:text-gray-100"
                value={input}
                onChange={(e) => {
                    const next = e.target.value;
                    setInput(next);
                    if (selectedLabel && next !== selectedLabel) {
                        setSelectedLabel("");
                    }
                    onChangeLabel(next);
                }}
                onFocus={() => {
                    if (suggestions.length) setOpen(true);
                }}
                onBlur={() => {
                    window.setTimeout(() => setOpen(false), 150);
                }}
                placeholder="Start typing an address…"
            />
            {loading && (
                <div className="absolute right-3 top-2.5 text-xs text-gray-400 dark:text-gray-500">
                    …
                </div>
            )}

            {open && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow max-h-60 overflow-y-auto dark:bg-neutral-900 dark:border-white/10 dark:text-gray-100">
                    {suggestions.map((suggestion) => (
                        <button
                            key={suggestion.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/10"
                            onClick={() => handleSelect(suggestion)}
                        >
                            {suggestion.label}
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
