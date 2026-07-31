"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setSubmitting(false);
      setError("Incorrect email or password.");
      return;
    }

    router.refresh();
    router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06080c] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-yellow-500/30 bg-black/75 shadow-2xl backdrop-blur-sm">
        <div className="h-1 bg-gradient-to-r from-red-600 via-yellow-400 to-blue-600" />

        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-yellow-500/40 bg-black">
              <Image
                src="/protectplus-logo.png"
                alt="ProtectPlus"
                fill
                sizes="48px"
                className="object-contain p-1"
              />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500">
                ProtectPlus CRM
              </p>
              <h1 className="text-2xl font-black text-white">Sign in</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block font-semibold text-gray-300">Email</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-yellow-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-semibold text-gray-300">Password</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-yellow-500"
              />
            </label>

            {error && <p className="text-sm font-semibold text-red-400">{error}</p>}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            Accounts are created by an agency admin — there is no public sign-up.
          </p>
        </div>
      </div>
    </main>
  );
}
