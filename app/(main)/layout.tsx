import { FC, ReactNode } from "react";
import Navbar from "@/components/Navbar";

interface AuthLayoutProps {
    children: ReactNode;
}

const AuthLayout: FC<AuthLayoutProps> = ({ children }) => {
    return (
        <div className="flex">
            
            <div className="flex-1 min-h-screen mr-20 bg-zinc-100">
                
                {children}
            </div>
            {/* <Navbar /> */}
        </div>
    );
};

export default AuthLayout;