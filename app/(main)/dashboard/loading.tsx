export default function DashboardLoading() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-50 text-black dark:bg-neutral-950 dark:text-white">
            <span className="h-12 w-12 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" />
        </div>
    );
}
