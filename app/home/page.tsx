import Navbar from "@/components/Navbar";
import { buttonVariants } from "@/components/ui/button";
import User from "@/components/User";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Link from "next/link";

export default async function Home() {
    const session = await getServerSession(authOptions);
    return <div>
        <main className='h-screen flex flex-col justify-center items-center'>
            <Navbar />
            <h1 className="text-4xl">Home</h1>
            <Link className={buttonVariants()} href='/admin'>
                Open My Admin
            </Link>
            <h2>
                Client Session
            </h2>
            <User />
            <h2>Server Session</h2>
            {JSON.stringify(session)}
        </main>
        
    </div>
}