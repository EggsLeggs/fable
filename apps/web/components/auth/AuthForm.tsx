"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { t } from "@lingui/core/macro";
import { signIn, signUp, type SignUpEmailInput } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";

type Props = {
  mode: "login" | "signup";
};

const USERNAME_PATTERN = /^[a-z0-9_]+$/;

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const refCode = mode === "signup" ? (searchParams.get("ref") ?? null) : null;
  const trpcUtils = trpc.useUtils();
  const applyReferralMutation = trpc.referral.applyCode.useMutation();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
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
        const normalizedUsername = normalizeUsername(username);

        if (normalizedUsername.length < 3) {
          setError(t`Username must be at least 3 characters.`);
          setLoading(false);
          return;
        }

        if (!USERNAME_PATTERN.test(normalizedUsername)) {
          setError(t`Username can only contain lowercase letters, numbers, and underscores.`);
          setLoading(false);
          return;
        }

        const availability = await trpcUtils.user.checkUsernameAvailable.fetch({
          username: normalizedUsername,
        });

        if (!availability.available) {
          setError(t`This username is already taken.`);
          setLoading(false);
          return;
        }

        const result = await signUp.email({
          name,
          email,
          password,
          username: normalizedUsername,
        } as SignUpEmailInput & Parameters<typeof signUp.email>[0]);
        if (result.error) {
          setError(result.error.message ?? t`Sign up failed`);
          setLoading(false);
          return;
        }

        if (refCode) {
          try {
            await applyReferralMutation.mutateAsync({ code: refCode });
          } catch {
            // Non-fatal: proceed even if referral code is invalid
          }
        }
      } else {
        const result = await signIn.email({
          email: email.trim().toLowerCase(),
          password,
        });
        if (result.error) {
          setError(t`Invalid email or password.`);
          setLoading(false);
          return;
        }
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(t`Something went wrong. Please try again.`);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {mode === "signup" && (
        <>
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t`Enter your name`}
              required
              className="input"
            />
          </div>
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder={t`Choose a username`}
              required
              minLength={3}
              maxLength={30}
              autoComplete="username"
              className="input"
            />
          </div>
        </>
      )}
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t`Enter your email address`}
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
          placeholder={t`Enter your password`}
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
            ? t`Please wait...`
            : mode === "signup"
              ? t`Sign up with email`
              : t`Continue with email`}
        </button>
      </div>
      <p className="pt-2 text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>
            {t`Don't have an account?`}{" "}
            <Link href="/signup" className="text-foreground underline">
              {t`Sign up`}
            </Link>
          </>
        ) : (
          <>
            {t`Already have an account?`}{" "}
            <Link href="/login" className="text-foreground underline">
              {t`Log in`}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
