import Navbar from "@/components/Navbar";
import { buttonVariants } from "@/components/ui/button";
import User from "@/components/User";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Link from "next/link";

export default async function Home() {
    const session = await getServerSession(authOptions);
    return <div>
        <header className="w-full bg-white py-6 flex justify-center items-center z-20">
            <h1 className="font-serif font-bold text-5xl text-green-800 tracking-tight select-none">
                <span className="text-green-700">gymfluence</span>
            </h1>
        </header>
        <main className='h-screen flex flex-col justify-center items-center'>
            <h1 className="text-4xl">Home</h1>
            <Link className={buttonVariants()} href='/admin'>
                Open My Admin
            </Link>
        </main>

    </div>
}