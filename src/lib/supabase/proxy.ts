import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnvironment, isSupabaseConfigured } from "./env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Keep the setup page usable before the project credentials are supplied.
  if (!isSupabaseConfigured()) return response;

  const { url, key } = getSupabaseEnvironment();
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const previousResponse = response;
        response = NextResponse.next({ request });
        previousResponse.cookies.getAll().forEach((cookie) => {
          response.cookies.set(cookie);
        });
        // Cache headers are only supplied on the client's first cookie write.
        for (const name of ["cache-control", "expires", "pragma"]) {
          const value = previousResponse.headers.get(name);
          if (value) response.headers.set(name, value);
        }
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  // Validate the token and refresh expiring sessions. RLS still enforces access.
  await supabase.auth.getClaims();
  return response;
}
