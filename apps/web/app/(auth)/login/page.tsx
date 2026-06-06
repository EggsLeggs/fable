"use client";

import Link from "next/link";
import { Suspense } from "react";
import { t } from "@lingui/core/macro";
import { AuthForm } from "@/components/auth/AuthForm";
import { FableIcon } from "@/components/FableIcon";

export default function LoginPage() {
  return (
    <main className="h-screen pt-20 sm:pt-0">
      <div className="flex h-full flex-col items-center justify-start px-4 sm:justify-center">
        <div className="flex w-full max-w-md flex-col items-center">
          <Link href="/" className="mb-6 flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
            <FableIcon className="h-6 w-auto" />
            fable
          </Link>
          <p className="mb-10 text-3xl font-bold tracking-tight text-foreground">{t`Welcome back`}</p>
          <div className="w-full rounded-lg border border-border bg-card/80 px-4 py-10 sm:max-w-md lg:px-10">
            <Suspense
              fallback={
                <p className="text-center text-sm text-muted-foreground">{t`Loading...`}</p>
              }
            >
              <AuthForm mode="login" />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
