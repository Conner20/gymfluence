import Link from "@/node_modules/next/link";
import React from "react"
import { House } from 'lucide-react';


const Navbar = () => {
    return (
        <div>
            <Link href='/home'><House /></Link>
        </div>
    )
};

export default Navbar;