"use client";

import { Dropdown } from "@/components/ui/Dropdown";
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

export function NotificationBell() {
  const { notifications, setNotifications, notificationsLoaded } = useNotifications();
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  function markAllRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }

  return (
    <Dropdown
      align="right"
      panelClassName="w-80"
      trigger={
        <span className="relative rounded-lg border border-yellow-500/30 p-2 text-yellow-400 transition hover:bg-yellow-500/10">
          🔔
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white">
              {unreadCount}
            </span>
          )}
        </span>
      }
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <p className="font-bold text-white">Notifications</p>
        <button
          type="button"
          onClick={markAllRead}
          className="text-xs font-bold text-yellow-400 hover:text-yellow-300"
        >
          Mark all read
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {!notificationsLoaded || notifications.length === 0 ? (
          <EmptyState icon="🔕" title="No notifications" />
        ) : (
          notifications
            .slice()
            .reverse()
            .map((notification) => (
              <div
                key={notification.id}
                className={`flex gap-3 border-b border-white/5 px-5 py-4 last:border-b-0 ${
                  notification.read ? "opacity-60" : ""
                }`}
              >
                <span className="text-lg">{ICONS[notification.type]}</span>
                <div>
                  <p className="text-sm text-gray-200">{notification.message}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDate(notification.timestamp)}
                  </p>
                </div>
              </div>
            ))
        )}
      </div>
    </Dropdown>
  );
}
