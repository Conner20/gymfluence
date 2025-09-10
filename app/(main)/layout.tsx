import { FC, ReactNode } from "react";
import Navbar from "@/components/Navbar";

interface AuthLayoutProps {
    children: ReactNode;
}

const AuthLayout: FC<AuthLayoutProps> = ({ children }) => {
    return (
        <div className="flex bg-[#f8f8f8]">
            
            <div className="flex-1 min-h-screen mr-20 bg-[#f8f8f8]">
                
                {children}
            </div>
            {/* <Navbar /> */}
        </div>
    );
};

export default AuthLayout;