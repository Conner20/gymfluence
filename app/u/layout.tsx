import { FC, ReactNode } from "react";
import Navbar from "@/components/Navbar";

interface AuthLayoutProps {
    children: ReactNode;
}

const AuthLayout: FC<AuthLayoutProps> = ({ children }) => {
    return (
        <div className="flex min-h-screen w-full">
            <div className="flex-1 bg-zinc-100 mr-0 lg:mr-20">
                {children}
            </div>
            <Navbar mobileOpen={false} />
        </div>
    );
};

export default AuthLayout;
