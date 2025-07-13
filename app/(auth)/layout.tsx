import { FC, ReactNode } from "react";

interface AuthLayoutProps {
    children: ReactNode;
}

const AuthLayout: FC<AuthLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="bg-slate-200 p-10 rounded-md w-full max-w-md">
                {children}
            </div>
        </div>
    );
};

export default AuthLayout;