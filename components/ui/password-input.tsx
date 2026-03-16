import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

type Props = React.ComponentPropsWithoutRef<typeof Input>;

const PasswordInput = React.forwardRef<HTMLInputElement, Props>(function PasswordInput(
    { className, ...props },
    ref,
) {
    const [visible, setVisible] = React.useState(false);

    return (
        <div className="relative">
            <Input
                ref={ref}
                type={visible ? "text" : "password"}
                className={cn("pr-10", className)}
                {...props}
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={visible ? "Hide password" : "Show password"}
            >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    );
});

export { PasswordInput };
