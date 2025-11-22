import { Suspense } from "react";
import Link from "next/link";
import SignUpForm from "@/components/form/SignUpForm"

const page = () => {
    return (
        <div className="bg-slate-200 p-10 rounded-md w-full max-w-md space-y-4">
            <Suspense fallback={<div className="text-center text-sm text-gray-500">Loading…</div>}>
                <SignUpForm />
            </Suspense>
            <div className="text-center">
                <Link
                    href="/"
                    className="inline-flex items-center text-sm text-green-700 hover:text-green-900 transition-colors"
                >
                    Back
                </Link>
            </div>
        </div>
    )
}

export default page;
