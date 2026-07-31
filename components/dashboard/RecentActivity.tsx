"use client";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDate } from "@/lib/format";

const ICONS: Record<string, string> = {
  renewal: "🔔",
  task: "✅",
  lead: "🎯",
  quote: "📋",
  policy: "🛡️",
};

export function RecentActivity() {
  const { notifications, notificationsLoaded } = useNotifications();

  return (
    <Card className="p-6">
      <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Recent Activity</p>

      <div className="mt-4 space-y-4">
        {!notificationsLoaded || notifications.length === 0 ? (
          <EmptyState icon="📭" title="No recent activity" />
        ) : (
          notifications
            .slice()
            .reverse()
            .slice(0, 6)
            .map((notification) => (
              <div key={notification.id} className="flex gap-3">
                <span className="text-lg">{ICONS[notification.type]}</span>
                <div>
                  <p className="text-sm text-gray-200">{notification.message}</p>
                  <p className="text-xs text-gray-500">{formatDate(notification.timestamp)}</p>
                </div>
              </div>
            ))
        )}
      </div>
    </Card>
  );
}
