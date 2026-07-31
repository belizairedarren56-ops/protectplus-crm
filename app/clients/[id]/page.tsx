"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

export default function ClientProfilePage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const savedClients = localStorage.getItem("protectplus-clients");

    if (savedClients) {
      try {
        const clients = JSON.parse(savedClients) as Client[];
        const foundClient = clients.find(
          (item) => item.id === clientId
        );

        setClient(foundClient ?? null);
      } catch (error) {
        console.error("Could not load client:", error);
      }
    }

    const savedNotes = localStorage.getItem(
      `protectplus-client-notes-${clientId}`
    );

    if (savedNotes) {
      setNotes(savedNotes);
    }

    setLoaded(true);
  }, [clientId]);

  function saveNotes() {
    localStorage.setItem(
      `protectplus-client-notes-${clientId}`,
      notes
    );

    alert("Notes saved.");
  }

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06080c] text-white">
        <p className="text-gray-400">Loading client...</p>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06080c] p-8 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-black text-red-400">
            Client not found
          </h1>

          <Link
            href="/clients"
            className="mt-6 inline-block rounded-xl border border-yellow-500/40 px-5 py-3 font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Back to Clients
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06080c] p-8 text-white">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[800px] w-[800px] bg-[url('/protectplus-logo.png')] bg-contain bg-center bg-no-repeat opacity-[0.06]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
              ProtectPlus Client Profile
            </p>

            <h1 className="mt-2 text-5xl font-black">
              {client.firstName} {client.lastName}
            </h1>

            <p className="mt-2 text-gray-400">
              View contact information, insurance details, and notes.
            </p>
          </div>

          <Link
            href="/clients"
            className="rounded-xl border border-yellow-500/40 px-5 py-3 font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Back to Clients
          </Link>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-yellow-500/20 bg-black/75 p-6 backdrop-blur-sm">
            <p className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Contact
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="mt-1 font-bold text-white">
                  {client.phone}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="mt-1 font-bold text-white">
                  {client.email}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-black/75 p-6 backdrop-blur-sm">
            <p className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Insurance
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-sm text-gray-500">
                  Insurance Type
                </p>

                <p className="mt-1 font-bold text-white">
                  {client.policyType}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Status</p>

                <span className="mt-2 inline-block rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-400">
                  {client.status}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-black/75 p-6 backdrop-blur-sm">
            <p className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Client ID
            </p>

            <p className="mt-5 break-all font-mono text-yellow-400">
              {client.id}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-black/75 p-6 backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-black text-yellow-400">
              Notes
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Save follow-ups, coverage questions, and client details.
            </p>
          </div>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Example: Call Friday to discuss umbrella coverage..."
            className="mt-5 min-h-48 w-full rounded-xl border border-gray-700 bg-black px-4 py-4 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500"
          />

          <button
            onClick={saveNotes}
            className="mt-4 rounded-xl border border-yellow-300 bg-gradient-to-r from-yellow-400 to-amber-600 px-6 py-3 font-black text-black hover:brightness-110"
          >
            Save Notes
          </button>
        </div>
      </div>
    </main>
  );
}