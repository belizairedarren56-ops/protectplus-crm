"use client";

import { FormEvent, useEffect, useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CARRIERS } from "@/lib/constants";
import { getItem, setItem } from "@/lib/storage";
import { useDemoData } from "@/hooks/useDemoData";

type AgencyUser = { id: string; name: string; email: string; role: string };

type AgencySettings = {
  agencyName: string;
  phone: string;
  email: string;
  address: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  notifyEmail: boolean;
  notifyRenewals: boolean;
  notifyTasks: boolean;
  notifyLeads: boolean;
  users: AgencyUser[];
  carriers: string[];
};

const SETTINGS_KEY = "protectplus-settings";

const DEFAULT_SETTINGS: AgencySettings = {
  agencyName: "ProtectPlus Insurance",
  phone: "954-555-0100",
  email: "hello@protectplus.com",
  address: "100 Las Olas Blvd, Fort Lauderdale, FL 33301",
  primaryColor: "#f5c344",
  secondaryColor: "#1c5cab",
  accentColor: "#e34948",
  notifyEmail: true,
  notifyRenewals: true,
  notifyTasks: true,
  notifyLeads: false,
  users: [
    { id: "1", name: "Darren Belizaire", email: "darren@protectplus.com", role: "Agency Owner" },
    { id: "2", name: "Maria Gonzalez", email: "maria@protectplus.com", role: "Producer" },
  ],
  carriers: CARRIERS,
};

const TABS = [
  "Agency Information",
  "Brand Colors",
  "User Management",
  "Notification Preferences",
  "Carrier List",
  "Commission Rules",
  "Demo Data",
] as const;

type Tab = (typeof TABS)[number];

const FIELD_CLASSES =
  "w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AgencySettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Agency Information");
  const [savedMessage, setSavedMessage] = useState(false);
  const { loadDemoData, clearDemoData, hasDemoData, counts } = useDemoData();

  useEffect(() => {
    // localStorage read must happen post-mount (SSR has no access to it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(getItem(SETTINGS_KEY, DEFAULT_SETTINGS));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setItem(SETTINGS_KEY, settings);
  }, [settings, loaded]);

  function handleSave(event: FormEvent) {
    event.preventDefault();
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
          ProtectPlus CRM
        </p>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">Settings</h1>
        <p className="mt-2 text-gray-400">Agency configuration. No backend yet — saved locally.</p>
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "whitespace-nowrap rounded-t-xl border-b-2 px-4 py-3 text-sm font-bold transition",
              activeTab === tab
                ? "border-yellow-400 text-yellow-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="mt-6">
        {activeTab === "Agency Information" && (
          <Card className="space-y-5 p-6">
            <FormField label="Agency Name">
              <input
                value={settings.agencyName}
                onChange={(event) => setSettings({ ...settings, agencyName: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FormField>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Phone">
                <input
                  value={settings.phone}
                  onChange={(event) => setSettings({ ...settings, phone: event.target.value })}
                  className={FIELD_CLASSES}
                />
              </FormField>
              <FormField label="Email">
                <input
                  value={settings.email}
                  onChange={(event) => setSettings({ ...settings, email: event.target.value })}
                  className={FIELD_CLASSES}
                />
              </FormField>
            </div>
            <FormField label="Address">
              <input
                value={settings.address}
                onChange={(event) => setSettings({ ...settings, address: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FormField>
          </Card>
        )}

        {activeTab === "Brand Colors" && (
          <Card className="space-y-5 p-6">
            <p className="text-sm text-gray-500">
              Cosmetic reference values for a future white-label theme. The CRM UI currently stays
              on the ProtectPlus gold/blue/red brand.
            </p>
            <div className="grid gap-5 md:grid-cols-3">
              <ColorField
                label="Primary"
                value={settings.primaryColor}
                onChange={(value) => setSettings({ ...settings, primaryColor: value })}
              />
              <ColorField
                label="Secondary"
                value={settings.secondaryColor}
                onChange={(value) => setSettings({ ...settings, secondaryColor: value })}
              />
              <ColorField
                label="Accent"
                value={settings.accentColor}
                onChange={(value) => setSettings({ ...settings, accentColor: value })}
              />
            </div>
          </Card>
        )}

        {activeTab === "User Management" && (
          <Card className="p-6">
            <div className="space-y-3">
              {settings.users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-white">{user.name}</p>
                    <p className="text-xs text-gray-500">
                      {user.email} • {user.role}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        users: settings.users.filter((item) => item.id !== user.id),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() =>
                setSettings({
                  ...settings,
                  users: [
                    ...settings.users,
                    {
                      id: Date.now().toString(),
                      name: "New Team Member",
                      email: "new@protectplus.com",
                      role: "Producer",
                    },
                  ],
                })
              }
            >
              + Add User
            </Button>
          </Card>
        )}

        {activeTab === "Notification Preferences" && (
          <Card className="space-y-4 p-6">
            <ToggleRow
              label="Email alerts"
              checked={settings.notifyEmail}
              onChange={(value) => setSettings({ ...settings, notifyEmail: value })}
            />
            <ToggleRow
              label="Renewal reminders"
              checked={settings.notifyRenewals}
              onChange={(value) => setSettings({ ...settings, notifyRenewals: value })}
            />
            <ToggleRow
              label="Task assignments"
              checked={settings.notifyTasks}
              onChange={(value) => setSettings({ ...settings, notifyTasks: value })}
            />
            <ToggleRow
              label="New lead alerts"
              checked={settings.notifyLeads}
              onChange={(value) => setSettings({ ...settings, notifyLeads: value })}
            />
          </Card>
        )}

        {activeTab === "Carrier List" && (
          <Card className="p-6">
            <div className="flex flex-wrap gap-2">
              {settings.carriers.map((carrier) => (
                <span
                  key={carrier}
                  className="flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/5 px-4 py-2 text-sm font-semibold text-yellow-300"
                >
                  {carrier}
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        carriers: settings.carriers.filter((item) => item !== carrier),
                      })
                    }
                    className="text-yellow-500 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <CarrierAddRow
              onAdd={(name) =>
                setSettings({ ...settings, carriers: [...settings.carriers, name] })
              }
            />
          </Card>
        )}

        {activeTab === "Commission Rules" && (
          <Card className="p-6">
            <p className="text-lg font-bold text-white">Commission Rules — Coming Soon</p>
            <p className="mt-2 text-sm text-gray-500">
              Per-carrier and per-product commission schedules will be configurable here once the
              agency moves off localStorage and onto a real backend.
            </p>
          </Card>
        )}

        {activeTab === "Demo Data" && (
          <Card className="p-6">
            <p className="text-lg font-bold text-white">Demo Data</p>
            <p className="mt-2 text-sm text-gray-500">
              Populates the CRM with realistic sample clients, policies, quotes, leads, tasks, and
              documents for exploring the app. Demo records are tagged internally, so clearing them
              only ever removes what this tool generated — any client, policy, quote, lead, task, or
              document you created yourself is never touched by either button below.
            </p>

            {hasDemoData ? (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-gray-300">
                <p className="font-bold text-emerald-400">Demo data is currently loaded.</p>
                <p className="mt-1 text-gray-500">
                  {counts.clients} clients · {counts.policies} policies · {counts.quotes} quotes ·{" "}
                  {counts.leads} leads · {counts.tasks} tasks · {counts.documents} documents
                </p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-gray-500">No demo data is currently loaded.</p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={loadDemoData}>
                {hasDemoData ? "Reload Demo Data" : "Load Demo Data"}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={clearDemoData}
                disabled={!hasDemoData}
              >
                Clear Demo Data
              </Button>
            </div>
          </Card>
        )}

        {activeTab !== "Demo Data" && (
          <div className="mt-6 flex items-center gap-4">
            <Button type="submit">Save Settings</Button>
            {savedMessage && <p className="text-sm font-bold text-emerald-400">Saved.</p>}
          </div>
        )}
      </form>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold text-gray-300">{label}</span>
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold text-gray-300">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-11 cursor-pointer rounded-lg border border-gray-700 bg-black"
        />
        <span className="font-mono text-sm text-gray-400">{value}</span>
      </div>
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <span className="font-semibold text-gray-200">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-yellow-500"
      />
    </label>
  );
}

function CarrierAddRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <div className="mt-4 flex gap-3">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Add a carrier..."
        className={FIELD_CLASSES}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          if (!value.trim()) return;
          onAdd(value.trim());
          setValue("");
        }}
      >
        Add
      </Button>
    </div>
  );
}
