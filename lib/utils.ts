import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TimeInput = string | number | Date;

export function formatRelativeTime(input: TimeInput): string {
  const date =
    input instanceof Date
      ? input
      : typeof input === "number"
        ? new Date(input)
        : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  if (seconds < 5) return "just now";

  const units = [
    { seconds: 31536000, singular: "yr", plural: "yrs" },
    { seconds: 2592000, singular: "mo", plural: "mos" },
    { seconds: 604800, singular: "wk", plural: "wks" },
    { seconds: 86400, singular: "day", plural: "days" },
    { seconds: 3600, singular: "hr", plural: "hrs" },
    { seconds: 60, singular: "min", plural: "mins" },
    { seconds: 1, singular: "sec", plural: "secs" },
  ];

  for (const unit of units) {
    if (seconds >= unit.seconds) {
      const value = Math.floor(seconds / unit.seconds);
      const label = value === 1 ? unit.singular : unit.plural;
      return `${value} ${label} ago`;
    }
  }

  return "just now";
}
