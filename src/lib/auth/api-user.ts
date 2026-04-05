import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/auth/user-service";

/**
 * User id for the current request (session or dev fallback). Null if unauthenticated.
 */
export async function getApiUserId(): Promise<string | null> {
  return resolveUserId();
}

/**
 * Returns user id or a 401 JSON response for route handlers.
 */
export async function requireApiUserId(): Promise<
  { userId: string } | { response: NextResponse }
> {
  const userId = await getApiUserId();
  if (!userId) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { userId };
}
