"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  email?: string;
  src?: string | null;
  className?: string;
};

async function computeGravatarUrl(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const msgBuffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `https://www.gravatar.com/avatar/${hashHex}?s=80&d=identicon`;
}

export function UserAvatar({ name, email, src, className }: Props) {
  const [gravatarUrl, setGravatarUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    if (!src && email) {
      void computeGravatarUrl(email).then(setGravatarUrl);
    } else {
      setGravatarUrl(null);
    }
  }, [src, email]);

  const imgSrc = src ?? gravatarUrl;
  const showImage = Boolean(imgSrc) && !imgFailed;
  const initials = (name || email || "?").charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
        className ?? "h-7 w-7",
      )}
    >
      {showImage ? (
        <img
          src={imgSrc ?? undefined}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="text-[45%] font-medium text-muted-foreground select-none">
          {initials}
        </span>
      )}
    </div>
  );
}
