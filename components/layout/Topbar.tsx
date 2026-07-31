"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { useClients } from "@/hooks/useClients";

const LABELS: Record<string, string> = {
  clients: "Clients",
  leads: "Leads",
  quotes: "Quotes",
  policies: "Policies",
  tasks: "Tasks",
  documents: "Documents",
  reports: "Reports",
  settings: "Settings",
};

type TopbarProps = { onMenuClick: () => void };

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const { clients } = useClients();

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [{ label: "Dashboard", href: "/" }];

  if (segments.length > 0) {
    const [first, second] = segments;
    crumbs.push({ label: LABELS[first] ?? first, href: `/${first}` });

    if (second) {
      if (first === "clients") {
        const client = clients.find((item) => String(item.id) === second);
        crumbs.push({
          label: client ? `${client.firstName} ${client.lastName}` : "Client Profile",
        });
      } else {
        crumbs.push({ label: second });
      }
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-yellow-500/20 bg-[#06080c]/95 px-4 py-4 backdrop-blur-sm md:px-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg border border-yellow-500/30 p-2 text-yellow-400 md:hidden"
        >
          ☰
        </button>

        <div className="min-w-0 flex-1">
          <GlobalSearch />
        </div>

        <NotificationBell />

        <div className="hidden items-center gap-3 border-l border-white/10 pl-4 sm:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 font-black text-black">
            DB
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-bold text-white">Darren Belizaire</p>
            <p className="text-xs text-gray-500">Agency Owner</p>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Breadcrumb items={crumbs} />
      </div>
    </header>
  );
}
