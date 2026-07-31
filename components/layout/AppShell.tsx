"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { LocalDataBanner } from "@/components/layout/LocalDataBanner";

// No automatic demo-data loading here on purpose: every entity hook already
// initializes safely to `[]` when localStorage is empty, so there is nothing
// to gate page rendering on. Demo data is an explicit action from
// Settings > Demo Data (see hooks/useDemoData.ts) — never triggered on mount.
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  // /login has no sidebar/topbar/app chrome — it's the one route reachable
  // while signed out (see proxy.ts).
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#06080c] text-white">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <LocalDataBanner />
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
