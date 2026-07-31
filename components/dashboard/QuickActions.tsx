"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const LINK_ACTION_STYLES =
  "flex items-center justify-center rounded-xl border border-yellow-500/40 px-5 py-2.5 text-center font-bold text-yellow-400 transition hover:bg-yellow-500/10";

export function QuickActions({ onAddClient }: { onAddClient: () => void }) {
  return (
    <Card className="p-6">
      <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Quick Actions</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Button onClick={onAddClient}>+ New Client</Button>
        <Link href="/leads" className={LINK_ACTION_STYLES}>
          + New Lead
        </Link>
        <Link href="/quotes" className={LINK_ACTION_STYLES}>
          + New Quote
        </Link>
        <Link href="/tasks" className={LINK_ACTION_STYLES}>
          + New Task
        </Link>
      </div>
    </Card>
  );
}
