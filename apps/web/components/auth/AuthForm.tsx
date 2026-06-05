"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, signUp } from "@fable/auth/client";

type Props = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const result = await signUp.email({ name, email, password });
        if (result.error) {
          setError(result.error.message ?? "Sign up failed");
          setLoading(false);
          return;
        }
      } else {
        const result = await signIn.email({
          email: email.trim().toLowerCase(),
          password,
        });
        if (result.error) {
          setError("Invalid email or password.");
          setLoading(false);
          return;
        }
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {mode === "signup" && (
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            required
            className="input"
          />
        </div>
      )}
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          required
          autoComplete="email"
          className="input"
        />
      </div>
      <div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="input"
        />
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-6">
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading
            ? "Please wait…"
            : mode === "signup"
              ? "Sign up with email"
              : "Continue with email"}
        </button>
      </div>
      <p className="pt-2 text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-foreground underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-foreground underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
