import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/format";
import type { Client, Policy, Quote, Task } from "@/types";

type ActivityItem = { date: string; icon: string; label: string };

type ActivityTabProps = {
  client: Client;
  policies: Policy[];
  quotes: Quote[];
  tasks: Task[];
};

export function ActivityTab({ client, policies, quotes, tasks }: ActivityTabProps) {
  const items: ActivityItem[] = [];

  if (client.createdAt) {
    items.push({ date: client.createdAt, icon: "👤", label: "Client added to ProtectPlus CRM" });
  }

  policies.forEach((policy) => {
    items.push({
      date: policy.effectiveDate,
      icon: "🛡️",
      label: `${policy.product} policy issued with ${policy.carrier}`,
    });
  });

  quotes.forEach((quote) => {
    items.push({
      date: quote.createdAt,
      icon: "📋",
      label: `${quote.insuranceType} quote ${quote.status.toLowerCase()} — ${quote.carrier}`,
    });
  });

  tasks.forEach((task) => {
    items.push({
      date: task.dueDate,
      icon: task.status === "Complete" ? "✅" : "🕒",
      label: task.title,
    });
  });

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (items.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState icon="🕓" title="No activity yet" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-5">
        {items.map((item, index) => (
          <div key={`${item.date}-${index}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="text-lg">{item.icon}</span>
              {index < items.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-white/10" />}
            </div>
            <div className="pb-5">
              <p className="text-sm text-gray-200">{item.label}</p>
              <p className="text-xs text-gray-500">{formatDate(item.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
