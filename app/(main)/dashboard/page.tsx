import Link from 'next/link';
import Navbar from "@/components/Navbar";

export default async function Dashboard() {
    return <div className="min-h-screen bg-[#f8f8f8]">
        <header className="w-full bg-white py-6 flex justify-start items-center pl-[40px] z-20">
            <h1 className="font-roboto text-3xl text-black tracking-tight select-none">
                <span>workout log</span>
            </h1>
            <nav className="ml-auto">
                <Link href="/dashboard"
                    className="px-10 py-4 bg-black text-white font-medium">
                    workouts
                </Link>

                <Link href="/dashboard/wellness"
                    className="px-10 py-4 text-black font-medium hover:underline">
                    wellness
                </Link>

                <Link href="/dashboard/nutrition"
                    className="px-10 py-4 text-black font-medium hover:underline">
                    nutrition
                </Link>
            </nav>
        </header>
        <Navbar />
    </div>
}