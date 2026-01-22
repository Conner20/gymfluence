'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>("light");

    // sync initial theme from localStorage or prefers-color-scheme
    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = window.localStorage.getItem("theme");
        if (stored === "dark" || stored === "light") {
            setTheme(stored);
            return;
        }
        const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
        if (prefersDark) setTheme("dark");
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const root = window.document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        window.localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return ctx;
}
