'use client'

import { signIn } from "next-auth/react";
import { FC, ReactNode, useState } from "react";
import { Button } from "./ui/button";

interface GoogleSignInButtonProps {
    children: ReactNode;
    /**
     * Path the user should land on after Google completes the OAuth flow. Defaults to `/home`.
     * This can be any relative path within the app so it works in every deployment environment.
     */
    callbackUrl?: string;
    className?: string;
}

const GoogleSignInButton: FC<GoogleSignInButtonProps> = ({
    children,
    callbackUrl = "/home",
    className,
}) => {
    const [isLoading, setIsLoading] = useState(false);

    const loginWithGoogle = async () => {
        try {
            setIsLoading(true);
            await signIn("google", { callbackUrl });
        } catch (err) {
            console.error("Google sign-in failed", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            type="button"
            disabled={isLoading}
            onClick={loginWithGoogle}
            className={className ?? "w-full"}
            variant="secondary"
        >
            {isLoading && (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 mr-2 animate-spin"
                >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
            )}
            {children}
        </Button>
    );
};

export default GoogleSignInButton;
