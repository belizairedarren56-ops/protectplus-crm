import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client for Server Components/Actions/Route Handlers.
// Still only the public URL + anon key — this is the *user's* session
// client (RLS-scoped to whoever is logged in), not an admin client. See
// scripts/bootstrap-admin.ts for the only place the service-role key is
// ever used, and note it is never imported from anywhere under app/.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component that can't set cookies — safe
            // to ignore as long as proxy.ts is also refreshing the session.
          }
        },
      },
    }
  );
}
