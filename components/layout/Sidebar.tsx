"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "📊" },
  { label: "Clients", href: "/clients", icon: "👥" },
  { label: "Leads", href: "/leads", icon: "🎯" },
  { label: "Quotes", href: "/quotes", icon: "📋" },
  { label: "Policies", href: "/policies", icon: "🛡️" },
  { label: "Tasks", href: "/tasks", icon: "✅" },
  { label: "Documents", href: "/documents", icon: "📁" },
  { label: "Reports", href: "/reports", icon: "📈" },
  { label: "Settings", href: "/settings", icon: "⚙️" },
];

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={onClose} />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-yellow-500/30 bg-black p-5 shadow-2xl transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="border-b border-yellow-500/20 pb-6">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-yellow-500/40 bg-black">
              <Image
                src="/protectplus-logo.png"
                alt="ProtectPlus Logo"
                fill
                sizes="56px"
                priority
                className="object-contain p-1"
              />
            </div>

            <div>
              <h1 className="text-xl font-black tracking-wide text-yellow-400">
                ProtectPlus
              </h1>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                Insurance CRM
              </p>
            </div>
          </div>
        </div>

        <nav className="mt-7 flex-1 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 font-bold transition",
                  active
                    ? "border-yellow-300 bg-gradient-to-r from-yellow-400 to-amber-600 text-black shadow-lg shadow-yellow-500/20"
                    : "border-transparent text-gray-300 hover:border-yellow-500/30 hover:bg-yellow-500/10 hover:text-yellow-300"
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-yellow-500/30 bg-white/5 p-4">
          <p className="text-sm font-bold text-yellow-400">Protecting Today.</p>
          <p className="text-sm text-blue-400">Securing Tomorrow.</p>

          <div className="mt-4 flex gap-2">
            <div className="h-1 flex-1 rounded-full bg-red-600" />
            <div className="h-1 flex-1 rounded-full bg-yellow-400" />
            <div className="h-1 flex-1 rounded-full bg-blue-600" />
          </div>
        </div>
      </aside>
    </>
  );
}
