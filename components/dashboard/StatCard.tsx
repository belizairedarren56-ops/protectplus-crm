import clsx from "clsx";
import { Card } from "@/components/ui/Card";

type StatCardProps = {
  title: string;
  value: string;
  icon?: string;
  accent?: "gold" | "blue" | "red" | "emerald" | "silver";
  subtext?: string;
};

const ACCENT_STYLES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  gold: "from-yellow-400 to-amber-600",
  blue: "from-blue-400 to-blue-700",
  red: "from-red-400 to-red-700",
  emerald: "from-emerald-400 to-emerald-700",
  silver: "from-gray-200 to-gray-500",
};

export function StatCard({ title, value, icon, accent = "gold", subtext }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden p-6">
      <div
        className={clsx(
          "absolute left-0 top-0 h-1 w-full bg-gradient-to-r",
          ACCENT_STYLES[accent]
        )}
      />

      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>

      <h3 className="mt-4 text-4xl font-black text-white">{value}</h3>

      {subtext && <p className="mt-2 text-xs text-gray-500">{subtext}</p>}
    </Card>
  );
}
