'use client';

type ConfirmDialogProps = {
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmDialog({
    open,
    title = "Confirm",
    message,
    confirmLabel = "Yes",
    cancelLabel = "No",
    destructive = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-neutral-900 dark:text-white">
                <h3 className="text-base font-semibold text-black dark:text-white">{title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-white/70">{message}</p>
                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-full border border-black/10 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/5"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                            destructive
                                ? "border-red-500 text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-500/10"
                                : "border-black bg-black text-white hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
