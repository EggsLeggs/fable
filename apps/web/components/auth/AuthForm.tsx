"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { signIn, signUp, type SignUpEmailInput } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";

type Props = {
  mode: "login" | "signup";
};

const HANDLE_PATTERN = /^[a-z0-9_]+$/;

function normalizeHandle(value: string) {
  return value.trim().toLowerCase();
}

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const referralCode = searchParams.get("ref")?.trim().toUpperCase() ?? null;
  const trpcUtils = trpc.useUtils();

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const applyCodeMutation = trpc.referral.applyCode.useMutation();

  const referralQuery = trpc.referral.validateCode.useQuery(
    { code: referralCode ?? "" },
    {
      enabled: mode === "signup" && Boolean(referralCode),
      staleTime: 0,
      refetchOnMount: "always",
      retry: 2,
    }
  );

  const referralData = referralQuery.data;
  const referralMatchesUrl =
    Boolean(referralCode) &&
    referralData?.code === referralCode &&
    referralData.valid === true;
  const referral = referralMatchesUrl ? referralData : null;
  const signupHref = referralCode ? `/signup?ref=${referralCode}` : "/signup";

  async function completeSignup(startTrial: boolean) {
    setError(null);
    setLoading(true);

    try {
      const normalizedHandle = normalizeHandle(handle);

      if (normalizedHandle.length < 3) {
        setError(t`Handle must be at least 3 characters.`);
        setLoading(false);
        return;
      }

      if (!HANDLE_PATTERN.test(normalizedHandle)) {
        setError(t`Handle can only contain lowercase letters, numbers, and underscores.`);
        setLoading(false);
        return;
      }

      const availability = await trpcUtils.user.checkUsernameAvailable.fetch({
        username: normalizedHandle,
      });

      if (!availability.available) {
        setError(t`This handle is already taken.`);
        setLoading(false);
        return;
      }

      const result = await signUp.email({
        name,
        email,
        password,
        username: normalizedHandle,
      } as SignUpEmailInput & Parameters<typeof signUp.email>[0]);
      if (result.error) {
        setError(result.error.message ?? t`Sign up failed`);
        setLoading(false);
        return;
      }

      if (startTrial && referral && referralCode && referral.billingAvailable) {
        const params = new URLSearchParams({
          code: referralCode,
          billingCycle,
        });
        window.location.href = `/api/referral/start-trial?${params.toString()}`;
        return;
      }

      if (referral && referralCode) {
        try {
          await applyCodeMutation.mutateAsync({ code: referralCode });
        } catch {
          // Referral could not be applied; continue to dashboard.
        }
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(t`Something went wrong. Please try again.`);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const startTrial = Boolean(referral?.billingAvailable);
        await completeSignup(startTrial);
        return;
      }

      const result = await signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.error) {
        setError(t`Invalid email or password.`);
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(t`Something went wrong. Please try again.`);
      setLoading(false);
    }
  }

  function handleSkipTrial(e: React.MouseEvent) {
    e.preventDefault();
    void completeSignup(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {mode === "signup" && referralCode && referralQuery.isError && !referral && (
        <p className="mb-3 text-center text-xs text-muted-foreground">
          {t`Could not verify this referral link. You can still sign up.`}
        </p>
      )}

      {mode === "signup" && referral && (
        <p className="mb-3 text-center text-xs text-muted-foreground">
          <Trans>
            Referred by{" "}
            <span className="font-medium text-foreground">@{referral.referrerHandle}</span>
          </Trans>
        </p>
      )}

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
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              placeholder={t`Choose a handle`}
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

      {mode === "signup" && referral && (
        <section className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">
            {t`2 months of Pro free`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {referral.billingAvailable
              ? t`Sign up below, then add your card on the next screen to start your trial. Your referral discount is applied automatically.`
              : t`Your referral discount will be applied when you upgrade to Pro.`}
          </p>
          {referral.billingAvailable && (
            <div className="mt-3 flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
                  billingCycle === "monthly"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {t`Monthly`}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
                  billingCycle === "annual"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {t`Annual`}
                <span className="ml-1 text-[10px] font-semibold text-emerald-600">-10%</span>
              </button>
            </div>
          )}
        </section>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-6">
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading
            ? t`Please wait...`
            : mode === "signup"
              ? referral?.billingAvailable
                ? t`Sign up and start trial`
                : t`Sign up with email`
              : t`Continue with email`}
        </button>
        {mode === "signup" && referral?.billingAvailable && (
          <button
            type="button"
            disabled={loading}
            onClick={handleSkipTrial}
            className="mt-2 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t`Continue without subscribing for now`}
          </button>
        )}
      </div>
      <p className="pt-2 text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>
            {t`Don't have an account?`}{" "}
            <Link href={signupHref} className="text-foreground underline">
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
