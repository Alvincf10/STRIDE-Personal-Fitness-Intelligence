import { Suspense } from "react";
import { LoadingState } from "@/components/shared/ui";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--ink)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <Suspense fallback={<LoadingState label="Loading sign-in…" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
