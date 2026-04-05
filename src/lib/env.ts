import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // OpenAI
  OPENAI_API_KEY: z.string().startsWith("sk-", "OPENAI_API_KEY must start with sk-"),

  // Auth (optional — dev only)
  AUTH_DEV_FALLBACK_USER_ID: z.string().optional(),

  // Runtime
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Deployment (set by Vercel automatically)
  VERCEL_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `\n\nEnvironment validation failed:\n${formatted}\n\nCheck your .env file against .env.example\n`,
    );
  }

  // Warn if dev fallback is set in production
  if (
    result.data.NODE_ENV === "production" &&
    result.data.AUTH_DEV_FALLBACK_USER_ID
  ) {
    console.warn(
      "[env] WARNING: AUTH_DEV_FALLBACK_USER_ID is set in production — this should be removed",
    );
  }

  return result.data;
}

export const env = validateEnv();
