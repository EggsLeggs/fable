"use client";

import { useId, useState } from "react";
import { Copy, Check } from "lucide-react";
import { t } from "@lingui/core/macro";
import { Checkbox } from "@/components/ui/checkbox";

type InviteLinkState = {
  enabled: boolean;
  token: string | null;
};

type Props = {
  label: string;
  inviteLink: InviteLinkState | null;
  isPending: boolean;
  onToggle: (enabled: boolean) => void;
};

export function InviteLinkSection({
  label,
  inviteLink,
  isPending,
  onToggle,
}: Props) {
  const checkboxId = useId();
  const [copied, setCopied] = useState(false);

  if (!inviteLink) return null;

  const fullLink =
    typeof window !== "undefined" && inviteLink.token
      ? `${window.location.origin}/join/${inviteLink.token}`
      : null;

  const maskedLink =
    typeof window !== "undefined" && inviteLink.token
      ? `${window.location.origin}/join/${"*".repeat(inviteLink.token.length)}`
      : null;

  function handleCopy() {
    if (!fullLink) return;
    void navigator.clipboard.writeText(fullLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={inviteLink.enabled}
          onCheckedChange={(checked) => onToggle(checked === true)}
          disabled={isPending}
          className="mt-0.5"
        />
        <label htmlFor={checkboxId} className="cursor-pointer">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">
            {t`Anyone with the link can join. Disable to revoke access. Re-enabling creates a new link.`}
          </span>
        </label>
      </div>

      {inviteLink.enabled && fullLink && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="group relative w-max max-w-full cursor-default">
                <span className="block truncate font-mono text-sm text-muted-foreground transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:opacity-0">
                  {maskedLink}
                </span>
                <span className="absolute inset-0 truncate font-mono text-sm opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 translate-y-0.5">
                  {fullLink}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary shrink-0 px-2 py-1 text-xs"
              aria-label={t`Copy invite link`}
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {t`Copied`}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Copy className="h-3 w-3" />
                  {t`Copy`}
                </span>
              )}
            </button>
          </div>
      )}
    </div>
  );
}
