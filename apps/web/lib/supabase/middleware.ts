import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public, unauthenticated routes. `/f` is a hosted lead-capture form page and
  // `/api/forms` is its submission endpoint — both must be reachable by a
  // visitor with no session (CRM lead lifecycle, migration 00128). `/api/webhooks`
  // is reached by external providers, never a logged-in user.
  const publicRoutes = [
    "/login",
    "/invite",
    "/recovery",
    "/f/",
    "/api/forms/",
    "/api/webhooks/",
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // A logged-in user hitting an auth page is bounced to the dashboard — but a
  // logged-in user is still allowed on the lead-capture form, its API and the
  // webhook endpoints (they are public, not auth-only).
  const authOnlyRoutes = ["/login", "/recovery"];
  const isAuthOnlyRoute = authOnlyRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );
  if (user && isAuthOnlyRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
