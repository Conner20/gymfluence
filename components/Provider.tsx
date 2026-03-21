'use client'

import { SessionProvider } from "next-auth/react";
import { FC, ReactNode } from "react";
import { ThemeProvider } from "./ThemeProvider";
import PageViewTracker from "./PageViewTracker";
import DeletedUserSessionGuard from "./DeletedUserSessionGuard";

interface ProviderProps {
    children: ReactNode
}
const Provider: FC<ProviderProps> = ({ children }) => {
    return (
        <SessionProvider>
            <ThemeProvider>
                {children}
                <PageViewTracker />
                <DeletedUserSessionGuard />
            </ThemeProvider>
        </SessionProvider>
    );
};

export default Provider;
