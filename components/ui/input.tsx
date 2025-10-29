import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Normalizes `value` so controlled inputs never flip from uncontrolled→controlled.
 * - If `value` is provided, we coerce `null|undefined` to "".
 * - If `value` is NOT provided, we pass through `defaultValue` and leave it uncontrolled.
 */
const Input = React.forwardRef<HTMLInputElement, Props>(function Input(
  { className, type = "text", value, defaultValue, ...props },
  ref
) {
  const isControlled = value !== undefined;

  // If controlled, ensure value is always a string (empty string allowed for number/text)
  const normalizedValue = isControlled ? (value as any) ?? "" : undefined;
  const normalizedDefault = !isControlled ? defaultValue : undefined;

  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      value={normalizedValue}
      defaultValue={normalizedDefault}
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
