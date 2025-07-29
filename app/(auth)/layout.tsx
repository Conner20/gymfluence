import { FC, ReactNode } from "react";

interface AuthLayoutProps {
    children: ReactNode;
}

const AuthLayout: FC<AuthLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            {children}
        </div>
    );
};

export default AuthLayout;