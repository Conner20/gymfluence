import { Suspense } from "react";
import SignUpForm from "@/components/form/SignUpForm"

const page = () => {
    return (
        <div className="bg-slate-200 p-10 rounded-md w-full max-w-md">
            <Suspense fallback={<div className="text-center text-sm text-gray-500">Loading…</div>}>
                <SignUpForm />
            </Suspense>
        </div>
    )
}

export default page;
