import type { User as AuthUser } from "@supabase/supabase-js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const signupInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(200),
});

export type SignupInput = z.infer<typeof signupInputSchema>;

export async function getSessionAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Resolves the app user id: Supabase session user id, or dev fallback when configured.
 */
export async function resolveUserId(): Promise<string | null> {
  const user = await getSessionAuthUser();
  if (user) return user.id;
  const fallback = process.env.AUTH_DEV_FALLBACK_USER_ID;
  if (process.env.NODE_ENV !== "production" && fallback) return fallback;
  return null;
}

/**
 * Ensures a Prisma User row exists for the given Supabase user.
 */
export async function ensureAppUser(authUser: AuthUser) {
  const existing = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (existing) return existing;

  const email = authUser.email ?? "";
  const name =
    (typeof authUser.user_metadata?.name === "string" &&
      authUser.user_metadata.name) ||
    email.split("@")[0] ||
    "Chef";

  return prisma.user.create({
    data: {
      id: authUser.id,
      email: email || `pending-${authUser.id}@local.invalid`,
      name,
      dietaryRestrictions: [],
      kitchenEquipment: [],
    },
  });
}

export type CreateUserWithAuthResult =
  | { ok: true; userId: string; email: string; name: string }
  | { ok: false; code: "validation"; issues: z.core.$ZodIssue[] }
  | { ok: false; code: "auth_exists" | "auth_error"; message: string }
  | { ok: false; code: "db_error"; message: string };

export async function createUserWithAuth(
  input: unknown,
): Promise<CreateUserWithAuthResult> {
  const parsed = signupInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation", issues: parsed.error.issues };
  }

  const { email, password, name } = parsed.data;
  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("duplicate")
    ) {
      return {
        ok: false,
        code: "auth_exists",
        message: "An account with this email already exists.",
      };
    }
    return { ok: false, code: "auth_error", message: error.message };
  }

  if (!created.user) {
    return {
      ok: false,
      code: "auth_error",
      message: "Sign up failed: no user returned.",
    };
  }

  const authId = created.user.id;

  try {
    await prisma.user.create({
      data: {
        id: authId,
        email,
        name,
        dietaryRestrictions: [],
        kitchenEquipment: [],
        onboardingComplete: false,
      },
    });
  } catch (e) {
    await admin.auth.admin.deleteUser(authId);
    const msg = e instanceof Error ? e.message : "Database error";
    if (
      msg.includes("Unique constraint") ||
      msg.toLowerCase().includes("unique")
    ) {
      return {
        ok: false,
        code: "auth_exists",
        message: "An account with this email already exists.",
      };
    }
    return { ok: false, code: "db_error", message: msg };
  }

  return { ok: true, userId: authId, email, name };
}
