import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, Props>(function Input(
  { className, type = "text", value, defaultValue, onChange, ...props },
  ref
) {
  // If a `value` prop is provided, we treat it as controlled.
  const isControlled = value !== undefined;

  // Internal state for uncontrolled usage
  const [innerValue, setInnerValue] = React.useState<string>(
    (() => {
      if (isControlled) {
        // controlled: initial internal state doesn't really matter
        return ((value as any) ?? "") as string;
      }
      // uncontrolled: seed from defaultValue if provided
      if (defaultValue !== undefined && defaultValue !== null) {
        return String(defaultValue);
      }
      return "";
    })()
  );

  // Keep internal state in sync if parent switches the controlled value
  React.useEffect(() => {
    if (isControlled) {
      setInnerValue(((value as any) ?? "") as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setInnerValue(e.target.value);
    }
    onChange?.(e);
  };

  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      // Always controlled from React's perspective:
      value={innerValue}
      onChange={handleChange}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
});

export { Input };
