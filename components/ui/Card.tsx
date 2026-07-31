import { forwardRef, HTMLAttributes } from "react";
import clsx from "clsx";

type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={clsx(
        "rounded-2xl border border-yellow-500/20 bg-black/75 shadow-xl backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
});

Card.displayName = "Card";
