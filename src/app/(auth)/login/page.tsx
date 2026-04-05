import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4">
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
