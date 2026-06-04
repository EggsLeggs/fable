"use client";

import { ThemeProvider } from "next-themes";
import { TrpcProvider } from "@/lib/trpc/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TrpcProvider>{children}</TrpcProvider>
    </ThemeProvider>
  );
}
