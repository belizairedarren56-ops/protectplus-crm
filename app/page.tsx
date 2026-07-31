"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type Client = {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  policyType: string;
  status: string;
};

const emptyForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  policyType: "Auto",
};

export default function Home() {
  const [showForm, setShowForm] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    const savedClients = localStorage.getItem("protectplus-clients");

    if (savedClients) {
      try {
        setClients(JSON.parse(savedClients) as Client[]);
      } catch (error) {
        console.error("Could not load clients:", error);
      }
    }

    setClientsLoaded(true);
  }, []);

  useEffect(() => {
    if (!clientsLoaded) return;

    localStorage.setItem(
      "protectplus-clients",
      JSON.stringify(clients)
    );
  }, [clients, clientsLoaded]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newClient: Client = {
      id: Date.now(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      policyType: formData.policyType,
      status: "New Lead",
    };

    setClients((currentClients) => [newClient, ...currentClients]);
    setFormData(emptyForm);
    setShowForm(false);
  }

  return (
    <main className="flex min-h-screen bg-black text-white">
      {/* Sidebar */}
      <aside className="flex w-72 flex-col border-r border-yellow-500/30 bg-black p-5 shadow-2xl">
        <div className="border-b border-yellow-500/20 pb-6">
          <div className="flex items-center gap-3">
            <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-yellow-500/40 bg-black">
              <Image
                src="/protectplus-logo.png"
                alt="ProtectPlus Logo"
                fill
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

        <nav className="mt-7 space-y-2">
          <button className="w-full rounded-xl border border-yellow-300 bg-gradient-to-r from-yellow-400 to-amber-600 px-4 py-3 text-left font-black text-black shadow-lg shadow-yellow-500/20">
            Dashboard
          </button>

          {[
            "Clients",
            "Quotes",
            "Policies",
            "Commissions",
            "Reports",
            "Settings",
          ].map((item) => (
            <button
              key={item}
              className="w-full rounded-xl border border-transparent px-4 py-3 text-left text-gray-300 transition hover:border-yellow-500/30 hover:bg-yellow-500/10 hover:text-yellow-300"
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-yellow-500/30 bg-white/5 p-4">
          <p className="text-sm font-bold text-yellow-400">
            Protecting Today.
          </p>

          <p className="text-sm text-blue-400">
            Securing Tomorrow.
          </p>

          <div className="mt-4 flex gap-2">
            <div className="h-1 flex-1 rounded-full bg-red-600" />
            <div className="h-1 flex-1 rounded-full bg-yellow-400" />
            <div className="h-1 flex-1 rounded-full bg-blue-600" />
          </div>
        </div>
      </aside>

      {/* Main dashboard */}
      <section className="relative flex-1 overflow-hidden bg-[#06080c] p-8">
        {/* Large faded background logo */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="relative h-[850px] w-[850px] opacity-[0.10]">
            <Image
              src="/protectplus-logo.png"
              alt=""
              fill
              className="object-contain"
            />
          </div>
        </div>

        {/* Dark overlay to keep text readable */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/70" />

        {/* Page content */}
        <div className="relative z-10">
          <header className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
                Welcome back, Darren
              </p>

              <h2 className="mt-2 text-5xl font-black text-white">
                Dashboard
              </h2>

              <p className="mt-3 text-gray-400">
                Manage clients, policies, quotes, and commissions.
              </p>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="rounded-xl border border-yellow-300 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 px-7 py-4 font-black text-black shadow-lg shadow-yellow-500/25 transition hover:scale-[1.02]"
            >
              + New Client
            </button>
          </header>

          {/* Stats */}
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Clients"
              value={clients.length.toString()}
              accent="gold"
            />

            <StatCard
              title="Open Quotes"
              value="0"
              accent="blue"
            />

            <StatCard
              title="Policies Written"
              value="0"
              accent="red"
            />

            <StatCard
              title="Monthly Commission"
              value="$0"
              accent="silver"
            />
          </div>

          {/* Recent clients */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-yellow-500/30 bg-black/75 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-yellow-500/20 px-6 py-5">
              <div>
                <h3 className="text-2xl font-black text-yellow-400">
                  Recent Clients
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Your newest ProtectPlus leads and customers.
                </p>
              </div>

              <button className="font-bold text-yellow-400 hover:text-yellow-300">
                View All
              </button>
            </div>

            <div className="grid grid-cols-4 bg-white/5 px-6 py-4 text-sm font-bold uppercase tracking-wider text-gray-400">
              <p>Name</p>
              <p>Insurance Type</p>
              <p>Status</p>
              <p>Phone</p>
            </div>

            {!clientsLoaded ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Loading clients...
              </div>
            ) : clients.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="font-semibold text-gray-300">
                  No clients added yet.
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Click New Client to add your first customer.
                </p>
              </div>
            ) : (
              clients.map((client) => (
                <div
                  key={client.id}
                  className="grid grid-cols-4 items-center border-t border-white/10 px-6 py-5 transition hover:bg-yellow-500/5"
                >
                  <div>
                    <p className="font-bold text-white">
                      {client.firstName} {client.lastName}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {client.email}
                    </p>
                  </div>

                  <p className="font-semibold text-gray-300">
                    {client.policyType}
                  </p>

                  <div>
                    <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-400">
                      {client.status}
                    </span>
                  </div>

                  <p className="text-gray-300">{client.phone}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* New client popup */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-yellow-500/50 bg-[#0b0d12] shadow-2xl shadow-yellow-500/10">
            <div className="h-1 bg-gradient-to-r from-red-600 via-yellow-400 to-blue-600" />

            <div className="p-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-yellow-500">
                    ProtectPlus CRM
                  </p>

                  <h2 className="mt-2 text-3xl font-black text-white">
                    Add New Client
                  </h2>

                  <p className="mt-2 text-gray-400">
                    Enter the client&apos;s contact and insurance information.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-3xl text-gray-500 hover:text-white"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <FormInput
                    label="First Name"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(value) =>
                      setFormData({
                        ...formData,
                        firstName: value,
                      })
                    }
                  />

                  <FormInput
                    label="Last Name"
                    placeholder="Smith"
                    value={formData.lastName}
                    onChange={(value) =>
                      setFormData({
                        ...formData,
                        lastName: value,
                      })
                    }
                  />
                </div>

                <FormInput
                  label="Phone"
                  placeholder="954-555-1234"
                  type="tel"
                  value={formData.phone}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      phone: value,
                    })
                  }
                />

                <FormInput
                  label="Email"
                  placeholder="client@email.com"
                  type="email"
                  value={formData.email}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      email: value,
                    })
                  }
                />

                <div>
                  <label className="mb-2 block font-semibold text-gray-300">
                    Insurance Type
                  </label>

                  <select
                    value={formData.policyType}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        policyType: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-yellow-500"
                  >
                    <option>Auto</option>
                    <option>Home</option>
                    <option>Commercial</option>
                    <option>Life</option>
                    <option>Health</option>
                    <option>Boat</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-xl border border-gray-700 px-5 py-3 font-bold text-gray-300 hover:bg-white/5"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="rounded-xl border border-yellow-300 bg-gradient-to-r from-yellow-400 to-amber-600 px-6 py-3 font-black text-black hover:brightness-110"
                  >
                    Save Client
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

type StatCardProps = {
  title: string;
  value: string;
  accent: "gold" | "blue" | "red" | "silver";
};

function StatCard({ title, value, accent }: StatCardProps) {
  const accentStyles = {
    gold: "from-yellow-400 to-amber-600",
    blue: "from-blue-400 to-blue-700",
    red: "from-red-400 to-red-700",
    silver: "from-gray-200 to-gray-500",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/75 p-6 shadow-xl backdrop-blur-sm">
      <div
        className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${accentStyles[accent]}`}
      />

      <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </p>

      <h3 className="mt-4 text-4xl font-black text-white">
        {value}
      </h3>
    </div>
  );
}

type FormInputProps = {
  label: string;
  placeholder: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
};

function FormInput({
  label,
  placeholder,
  value,
  type = "text",
  onChange,
}: FormInputProps) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-gray-300">
        {label}
      </label>

      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white placeholder:text-gray-600 outline-none focus:border-yellow-500"
      />
    </div>
  );
}