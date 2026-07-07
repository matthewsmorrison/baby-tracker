import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";

export function Label({
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`block text-sm font-medium text-muted mb-1.5 ${className}`}
      {...props}
    />
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-2xl border border-line bg-surface-alt px-4 py-3 text-base text-ink placeholder:text-faint focus:border-ink focus:outline-none ${className}`}
      {...props}
    />
  );
}
