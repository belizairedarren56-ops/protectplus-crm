import clsx from "clsx";
import { colorFromString, initials } from "@/lib/format";

type AvatarProps = {
  firstName: string;
  lastName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_STYLES = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
};

export function Avatar({ firstName, lastName, size = "md", className }: AvatarProps) {
  const label = initials(firstName, lastName);
  const gradient = colorFromString(`${firstName}${lastName}`);

  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-black text-black",
        gradient,
        SIZE_STYLES[size],
        className
      )}
    >
      {label}
    </div>
  );
}
