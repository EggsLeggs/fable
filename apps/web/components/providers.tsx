"use client";

import { TrpcProvider } from "@/lib/trpc/client";
import { LinguiProvider } from "@/components/lingui-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LinguiProvider>
      <TrpcProvider>{children}</TrpcProvider>
    </LinguiProvider>
  );
}
