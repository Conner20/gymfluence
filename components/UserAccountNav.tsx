'use client'

import { Button } from "./ui/button";
import { signOut } from "next-auth/react";

const UserAccountNav = () => {
    return (
        <Button onClick={() => signOut({
            redirect: true,
            callbackUrl: `${window.location.origin}/log-in`
        })} variant="destructive">
            Log Out
        </Button>
    )
};

export default UserAccountNav;