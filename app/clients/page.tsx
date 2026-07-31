"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Client = {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  policyType: string;
  status: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const savedClients = localStorage.getItem("protectplus-clients");

    if (savedClients) {
      try {
        setClients(JSON.parse(savedClients) as Client[]);
      } catch (error) {
        console.error("Could not load clients:", error);
      }
    }
  }, []);

  const filteredClients = clients.filter((client) => {
    const searchValue = search.toLowerCase();

    return (
      `${client.firstName} ${client.lastName}`
        .toLowerCase()
        .includes(searchValue) ||
      client.email.toLowerCase().includes(searchValue) ||
      client.phone.toLowerCase().includes(searchValue) ||
      client.policyType.toLowerCase().includes(searchValue)
    );
  });

  function deleteClient(id: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this client?"
    );

    if (!confirmed) return;

    const updatedClients = clients.filter(
      (client) => client.id !== id
    );

    setClients(updatedClients);

    localStorage.setItem(
      "protectplus-clients",
      JSON.stringify(updatedClients)
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06080c] p-8 text-white">
      {/* Background logo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[800px] w-[800px] bg-[url('/protectplus-logo.png')] bg-contain bg-center bg-no-repeat opacity-[0.07]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
              ProtectPlus CRM
            </p>

            <h1 className="mt-2 text-5xl font-black">
              Clients
            </h1>

            <p className="mt-2 text-gray-400">
              Search and manage your insurance clients.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-yellow-500/40 px-5 py-3 font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-yellow-500/20 bg-black/70 p-6 backdrop-blur-sm">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, phone, or insurance type..."
            className="w-full rounded-xl border border-gray-700 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500"
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-yellow-500/20 bg-black/75 backdrop-blur-sm">
          <div className="grid grid-cols-5 bg-white/5 px-6 py-4 text-sm font-bold uppercase tracking-wider text-gray-400">
            <p>Name</p>
            <p>Insurance Type</p>
            <p>Status</p>
            <p>Phone</p>
            <p>Actions</p>
          </div>

          {filteredClients.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-500">
              No matching clients found.
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                className="grid grid-cols-5 items-center border-t border-white/10 px-6 py-5 hover:bg-yellow-500/5"
              >
                <div>
                  <p className="font-bold text-white">
                    {client.firstName} {client.lastName}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {client.email}
                  </p>
                </div>

                <p className="text-gray-300">
                  {client.policyType}
                </p>

                <div>
                  <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-400">
                    {client.status}
                  </span>
                </div>

                <p className="text-gray-300">
                  {client.phone}
                </p>

              <div className="flex gap-2">
  <Link
    href={`/clients/${client.id}`}
    className="rounded-lg border border-yellow-500/40 px-4 py-2 font-bold text-yellow-400 hover:bg-yellow-500/10"
  >
    View
  </Link>

  <button
    onClick={() => deleteClient(client.id)}
    className="rounded-lg border border-red-500/40 px-4 py-2 font-bold text-red-400 hover:bg-red-500/10"
  >
    Delete
  </button>
</div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}