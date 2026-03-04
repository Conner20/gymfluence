import { Suspense } from "react";
import Link from "next/link";
import SignUpForm from "@/components/form/SignUpForm"

const page = () => {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-neutral-50 px-4">
            <div className="w-full max-w-sm space-y-6 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl shadow-zinc-100">
                <Suspense
                    fallback={
                        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-950">
                            <span className="h-12 w-12 animate-spin rounded-full border-2 border-black border-t-transparent dark:border-white dark:border-t-transparent" />
                        </div>
                    }
                >
                    <SignUpForm />
                </Suspense>
                <div className="text-center">
                    <Link
                        href="/"
                        className="text-sm text-zinc-500 transition hover:text-zinc-800"
                    >
                        ← Back
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default page;
