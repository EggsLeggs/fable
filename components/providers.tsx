"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem enableColorScheme>
        {children}
        <Toaster
          theme="light"
          position="bottom-right"
          icons={{
            success: <CheckCircle2 className="size-4 shrink-0 text-accent" strokeWidth={2} />,
            error: <CircleAlert className="size-4 shrink-0 text-destructive" strokeWidth={2} />,
          }}
          toastOptions={{
            classNames: {
              toast:
                "!bg-white !border-border !text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
              title: "!text-foreground",
              description: "!text-muted-foreground",
            },
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
