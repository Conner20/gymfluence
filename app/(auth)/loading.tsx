'use client';

import { useTheme } from '@/components/ThemeProvider';

export default function AuthLoading() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <div
            className={
                isDark
                    ? 'fixed inset-0 flex items-center justify-center bg-neutral-950 text-white'
                    : 'fixed inset-0 flex items-center justify-center bg-gray-50 text-black'
            }
        >
            <span className="h-12 w-12 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" />
        </div>
    );
}
