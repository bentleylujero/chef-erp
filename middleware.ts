import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { apiLimiter, aiLimiter, authLimiter } from "@/lib/rate-limit";
import { rateLimited } from "@/lib/api-response";

// ── CORS ────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set<string>([
  // Add custom domain here when you have one
  // "https://chefbentley.com",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // same-origin requests have no Origin header
  if (process.env.NODE_ENV !== "production") return true; // allow all in dev
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow Vercel preview + production URLs
  if (origin.endsWith(".vercel.app")) return true;
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

// ── Rate limiting ───────────────────────────────────────────────

function getRateLimitKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function selectLimiter(pathname: string) {
  if (pathname.startsWith("/api/ai")) return aiLimiter;
  if (pathname.startsWith("/api/auth")) return authLimiter;
  if (pathname.startsWith("/api/")) return apiLimiter;
  return null;
}

// ── Middleware ───────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // Reject disallowed origins on API routes
  if (pathname.startsWith("/api/") && !isAllowedOrigin(origin)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Rate limiting for API routes
  const limiter = selectLimiter(pathname);
  if (limiter) {
    const key = getRateLimitKey(request);
    const result = limiter.check(key);
    if (!result.allowed) {
      const res = rateLimited(result.resetMs);
      // Add CORS headers to rate limit responses
      for (const [k, v] of Object.entries(corsHeaders(origin))) {
        res.headers.set(k, v);
      }
      return res;
    }
  }

  // ── Supabase auth session refresh ───────────────────────────

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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const devBypass =
    process.env.NODE_ENV !== "production" &&
    Boolean(process.env.AUTH_DEV_FALLBACK_USER_ID);

  const isPublic =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/onboarding");

  const isApi = pathname.startsWith("/api");

  // Redirect unauthenticated users to login (pages only, not API)
  if (!isPublic && !isApi && !user && !devBypass) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Attach CORS headers to all API responses
  if (isApi) {
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      supabaseResponse.headers.set(k, v);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
