"use client";

import { ThemeProvider } from "next-themes";
import { TrpcProvider } from "@/lib/trpc/client";
import { LinguiProvider } from "@/components/lingui-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LinguiProvider>
        <TrpcProvider>{children}</TrpcProvider>
      </LinguiProvider>
    </ThemeProvider>
  );
}
