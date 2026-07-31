"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "border border-yellow-300 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black font-black shadow-lg shadow-yellow-500/20 hover:brightness-110",
  secondary:
    "border border-yellow-500/40 text-yellow-400 font-bold hover:bg-yellow-500/10",
  danger: "border border-red-500/40 text-red-400 font-bold hover:bg-red-500/10",
  ghost: "border border-transparent text-gray-300 font-semibold hover:bg-white/5",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50",
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
