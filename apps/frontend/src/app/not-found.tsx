"use client"
import PublicShell from "./components/PublicShell";
import { Primary, Secondary } from "./components/Buttons";

export default function NotFound() {
  return (
    <PublicShell>
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4">
        <div className="font-satoshi font-medium text-4xl text-input-border-error mb-2">404</div>
        <div className="text-body-4 text-text-primary mb-8">
          Oops! The page you’re looking for doesn’t exist.
        </div>

        <div className="flex gap-3">
          <Secondary href="/" text="Go home" />
          <Primary href="/signin" text="Sign in" />
        </div>
      </div>
    </PublicShell>
  );
}
