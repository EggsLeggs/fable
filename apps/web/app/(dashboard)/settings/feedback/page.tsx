"use client";

import { FormEvent, useMemo, useState } from "react";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import { Input } from "@fable/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";

type Platform = "crowdin" | "lokalise" | "phrase" | "other";
type Rating = "1" | "2" | "3" | "4" | "5";
type SwitchingIntent = "yes" | "maybe" | "no";

type FeedbackFormState = {
  platform: Platform;
  otherPlatform: string;
  currentToolRating: Rating;
  likesCurrentTool: string;
  currentToolFrustration: string;
  fableRating: Rating;
  likesFable: string;
  dislikesFable: string;
  knownBugs: string;
  switchingIntent: SwitchingIntent;
};

const FEEDBACK_TEXT_MAX = 300;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-6 first:border-t-0 first:pt-0 last:pb-0">
      <div className="mb-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldGroup({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

function RatingScale({
  value,
  onChange,
  name,
}: {
  value: Rating;
  onChange: (next: Rating) => void;
  name: string;
}) {
  const options = useMemo(
    () => ["1", "2", "3", "4", "5"] as const,
    []
  );

  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as Rating)}
      className="grid grid-cols-5 gap-2"
    >
      {options.map((option) => {
        const id = `${name}-${option}`;
        const checked = value === option;
        return (
          <Label
            key={option}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 font-medium transition-colors",
              checked ? "border-foreground bg-secondary text-foreground" : "hover:bg-muted/50"
            )}
          >
            <RadioGroupItem value={option} id={id} className="sr-only" />
            {option}
          </Label>
        );
      })}
    </RadioGroup>
  );
}

function AlreadySubmittedBanner() {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-6 py-5 text-center">
      <p className="text-sm font-semibold text-foreground">
        {t`Form already submitted.`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t`Thank you for the feedback!`}
      </p>
    </div>
  );
}

export default function FeedbackSettingsPage() {
  const { data: submissionStatus, isLoading } = trpc.feedback.hasSubmitted.useQuery();
  const submitMutation = trpc.feedback.submit.useMutation({
    onSuccess() {
      toast.success(t`Thank you - your feedback has been recorded.`);
    },
    onError(error) {
      if (error.data?.code === "CONFLICT") {
        toast.error(t`You have already submitted feedback.`);
      } else {
        toast.error(t`Something went wrong. Please try again.`);
      }
    },
  });

  const [form, setForm] = useState<FeedbackFormState>({
    platform: "crowdin",
    otherPlatform: "",
    currentToolRating: "3",
    likesCurrentTool: "",
    currentToolFrustration: "",
    fableRating: "3",
    likesFable: "",
    dislikesFable: "",
    knownBugs: "",
    switchingIntent: "maybe",
  });

  function updateForm<K extends keyof FeedbackFormState>(
    key: K,
    value: FeedbackFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMutation.mutate({
      platform: form.platform,
      otherPlatform: form.platform === "other" ? form.otherPlatform : undefined,
      currentToolRating: parseInt(form.currentToolRating, 10),
      likesCurrentTool: form.likesCurrentTool,
      currentToolFrustration: form.currentToolFrustration,
      fableRating: parseInt(form.fableRating, 10),
      likesFable: form.likesFable,
      dislikesFable: form.dislikesFable,
      knownBugs: form.knownBugs,
      switchingIntent: form.switchingIntent,
    });
  }

  const alreadySubmitted = submissionStatus?.submitted || submitMutation.isSuccess;

  return (
    <div className="max-w-2xl">
      <Section
        title={t`Tell us how we did`}
        description={t`Share what is working, what is painful, and what would make Fable better for your team.`}
      >
        {!isLoading && alreadySubmitted ? (
          <AlreadySubmittedBanner />
        ) : (
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-0 border-t border-border">
              <div className="border-t border-border py-6">
                <FieldGroup label={t`1. Which localisation platform are you currently using?`}>
                  <RadioGroup
                    value={form.platform}
                    onValueChange={(next) => updateForm("platform", next as Platform)}
                    className="space-y-2"
                  >
                    <Label
                      htmlFor="platform-crowdin"
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 font-normal hover:bg-muted/50"
                    >
                      <RadioGroupItem value="crowdin" id="platform-crowdin" />
                      <span className="text-sm font-medium">Crowdin</span>
                    </Label>
                    <Label
                      htmlFor="platform-lokalise"
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 font-normal hover:bg-muted/50"
                    >
                      <RadioGroupItem value="lokalise" id="platform-lokalise" />
                      <span className="text-sm font-medium">Lokalise</span>
                    </Label>
                    <Label
                      htmlFor="platform-phrase"
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 font-normal hover:bg-muted/50"
                    >
                      <RadioGroupItem value="phrase" id="platform-phrase" />
                      <span className="text-sm font-medium">Phrase</span>
                    </Label>
                    <Label
                      htmlFor="platform-other"
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 font-normal hover:bg-muted/50"
                    >
                      <RadioGroupItem value="other" id="platform-other" />
                      <span className="text-sm font-medium">Other</span>
                    </Label>
                  </RadioGroup>
                  {form.platform === "other" ? (
                    <Input
                      value={form.otherPlatform}
                      onChange={(event) => updateForm("otherPlatform", event.target.value)}
                      placeholder={t`Tell us which platform you use`}
                      maxLength={FEEDBACK_TEXT_MAX}
                      className="mt-2"
                    />
                  ) : null}
                </FieldGroup>
              </div>

              <div className="border-t border-border py-6">
                <FieldGroup label={t`2. How would you rate your current platform?`}>
                  <RatingScale
                    name="current-tool-rating"
                    value={form.currentToolRating}
                    onChange={(next) => updateForm("currentToolRating", next)}
                  />
                </FieldGroup>
              </div>

              <div className="border-t border-border py-6">
                <FieldGroup label={t`3. What do you like most about your current platform?`}>
                  <textarea
                    value={form.likesCurrentTool}
                    onChange={(event) => updateForm("likesCurrentTool", event.target.value)}
                    maxLength={FEEDBACK_TEXT_MAX}
                    rows={3}
                    placeholder={t`The strengths you rely on...`}
                    className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </FieldGroup>
              </div>

              <div className="border-t border-border py-6">
                <FieldGroup label={t`4. What is your single biggest frustration with it?`}>
                  <textarea
                    value={form.currentToolFrustration}
                    onChange={(event) => updateForm("currentToolFrustration", event.target.value)}
                    maxLength={FEEDBACK_TEXT_MAX}
                    rows={3}
                    placeholder={t`The one thing you most want to fix...`}
                    className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </FieldGroup>
              </div>

              <div className="border-t border-border py-6">
                <FieldGroup label={t`5. How would you rate Fable so far?`}>
                  <RatingScale
                    name="fable-rating"
                    value={form.fableRating}
                    onChange={(next) => updateForm("fableRating", next)}
                  />
                </FieldGroup>
              </div>

              <div className="border-t border-border py-6">
                <FieldGroup label={t`6. What do you like about Fable?`}>
                  <textarea
                    value={form.likesFable}
                    onChange={(event) => updateForm("likesFable", event.target.value)}
                    maxLength={FEEDBACK_TEXT_MAX}
                    rows={3}
                    placeholder={t`Features, UX, speed, collaboration, anything that stands out.`}
                    className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </FieldGroup>
              </div>

              <div className="border-t border-border py-6">
                <FieldGroup label={t`7. Is there anything you dislike about Fable?`}>
                  <textarea
                    value={form.dislikesFable}
                    onChange={(event) => updateForm("dislikesFable", event.target.value)}
                    maxLength={FEEDBACK_TEXT_MAX}
                    rows={3}
                    placeholder={t`Is there anything you feel is missing orawkward?`}
                    className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </FieldGroup>
              </div>

              <div className="border-t border-border py-6">
                <FieldGroup
                  label={t`8. Are there any bugs we should know about?`}
                  description={t`Include steps to reproduce if you can.`}
                >
                  <textarea
                    value={form.knownBugs}
                    onChange={(event) => updateForm("knownBugs", event.target.value)}
                    maxLength={FEEDBACK_TEXT_MAX}
                    rows={4}
                    placeholder={t`What happened and where?`}
                    className="min-h-[104px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </FieldGroup>
              </div>

              <div className="border-t border-border py-6">
                <FieldGroup label={t`9. Would you consider switching to Fable?`}>
                  <RadioGroup
                    value={form.switchingIntent}
                    onValueChange={(next) =>
                      updateForm("switchingIntent", next as SwitchingIntent)
                    }
                    className="space-y-2"
                  >
                    <Label
                      htmlFor="switch-yes"
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 font-normal hover:bg-muted/50"
                    >
                      <RadioGroupItem value="yes" id="switch-yes" />
                      <span className="text-sm font-medium">{t`Yes`}</span>
                    </Label>
                    <Label
                      htmlFor="switch-maybe"
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 font-normal hover:bg-muted/50"
                    >
                      <RadioGroupItem value="maybe" id="switch-maybe" />
                      <span className="text-sm font-medium">{t`Maybe`}</span>
                    </Label>
                    <Label
                      htmlFor="switch-no"
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 font-normal hover:bg-muted/50"
                    >
                      <RadioGroupItem value="no" id="switch-no" />
                      <span className="text-sm font-medium">{t`No`}</span>
                    </Label>
                  </RadioGroup>
                </FieldGroup>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? t`Sending...` : t`Send feedback`}
              </Button>
            </div>
          </form>
        )}
      </Section>
    </div>
  );
}
