import Link from "@/node_modules/next/link";
import React from "react"
import { House } from 'lucide-react';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Button, buttonVariants } from "./ui/button";
import { signOut } from "next-auth/react";
import UserAccountNav from "./UserAccountNav";


const Navbar = async () => {
    const session = await getServerSession(authOptions);
    return (
        <div className="bg-zinc-100 py-2 border-b border-s-zinc-200 fixed w-full z-10 top-0">
            <div className="container flex items-center justify-between">
                <Link href='/home'>
                    <House />
                </Link>
                {session?.user ? (
                    <UserAccountNav />
                ) : (
                    <Link className={buttonVariants()} href='/log-in'>
                        Log In
                    </Link>
                )}
            </div>
        </div>
    )
};

export default Navbar;