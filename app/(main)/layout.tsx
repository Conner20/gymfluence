import { FC, ReactNode } from "react";
import Navbar from "@/components/Navbar";

interface AuthLayoutProps {
    children: ReactNode;
}

const AuthLayout: FC<AuthLayoutProps> = ({ children }) => {
    return (
        <div className="flex bg-[#f8f8f8] min-h-screen w-full">
            <div className="flex-1 bg-[#f8f8f8] mr-0 lg:mr-20">
                {children}
            </div>
        </div>
    );
};

export default AuthLayout;
