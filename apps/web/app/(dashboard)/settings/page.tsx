"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";
import { Button, Input } from "@fable/ui";
import { changePassword, deleteUser } from "@/lib/auth-client";
import type { SpokenLanguage, SpokenLanguageLevel } from "@fable/db";
import { trpc } from "@/lib/trpc/client";
import {
  SPOKEN_LANGUAGE_LEVELS,
  SPOKEN_LANGUAGES,
  TIME_FORMATS,
  TIMEZONES,
} from "@/lib/profile-constants";
import { SelectCombobox } from "@/components/ui/select-combobox";

type UpdateProfileInput = {
  name?: string;
  username?: string | null;
  timezone?: string;
  timeFormat?: "12h" | "24h";
  spokenLanguages?: SpokenLanguage[];
  profileVisibility?: "public" | "private";
};

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
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
}

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
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function InlineTextField({
  label,
  description,
  value,
  savedValue,
  onChange,
  onUpdate,
  updating,
  inputProps,
}: {
  label: string;
  description?: string;
  value: string;
  savedValue: string;
  onChange: (value: string) => void;
  onUpdate: () => void;
  updating: boolean;
  inputProps?: React.ComponentProps<typeof Input>;
}) {
  const isDirty = value !== savedValue;

  return (
    <FieldGroup label={label} description={description}>
      <div className="flex items-center gap-2">
        <Input
          {...inputProps}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        {isDirty && (
          <Button
            type="button"
            size="sm"
            onClick={onUpdate}
            disabled={updating}
            className="shrink-0"
          >
            {updating ? t`Updating...` : t`Update`}
          </Button>
        )}
      </div>
    </FieldGroup>
  );
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const userQuery = trpc.user.me.useQuery();
  const user = userQuery.data;
  const syncedUserId = useRef<string | null>(null);

  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined);
  const name = nameDraft ?? user?.name ?? "";
  const [handleDraft, setHandleDraft] = useState<string | undefined>(undefined);
  const handle = handleDraft ?? user?.username ?? "";
  const [timezone, setTimezone] = useState("UTC");
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("24h");
  const [spokenLanguages, setSpokenLanguages] = useState<SpokenLanguage[]>([]);
  const [profileVisibility, setProfileVisibility] = useState<"public" | "private">(
    "private"
  );
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user || syncedUserId.current === user.id) return;
    syncedUserId.current = user.id;
    setTimezone(user.timezone);
    setTimeFormat(user.timeFormat);
    setSpokenLanguages(user.spokenLanguages ?? []);
    setProfileVisibility(user.profileVisibility);
    setNameDraft(undefined);
    setHandleDraft(undefined);
  }, [user]);

  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onError: (err) => toast.error(err.message ?? t`Could not update profile.`),
  });

  function saveProfile(
    input: UpdateProfileInput,
    options: { field: string; toast?: boolean; refresh?: boolean } = {
      field: "profile",
    }
  ) {
    setUpdatingField(options.field);
    updateProfileMutation.mutate(input, {
      onSuccess: () => {
        void userQuery.refetch();
        if (input.name !== undefined) {
          setNameDraft(undefined);
        }
        if (input.username !== undefined) {
          setHandleDraft(undefined);
        }
        if (options.refresh) {
          router.refresh();
        }
        if (options.toast !== false) {
          toast.success(t`Updated.`);
        }
        setUpdatingField(null);
      },
      onError: () => {
        setUpdatingField(null);
      },
    });
  }

  function handleUpdateName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t`Name cannot be empty.`);
      return;
    }
    saveProfile({ name: trimmed }, { field: "name", refresh: true });
  }

  function handleUpdateHandle() {
    const normalized = handle.trim().toLowerCase();
    if (normalized && !/^[a-z0-9_]{3,30}$/.test(normalized)) {
      toast.error(
        t`Handle must be 3-30 characters and use only lowercase letters, numbers, and underscores.`
      );
      return;
    }
    saveProfile(
      { username: normalized === "" ? null : normalized },
      { field: "handle", refresh: true }
    );
  }

  function handleTimezoneChange(value: string) {
    setTimezone(value);
    saveProfile({ timezone: value }, { field: "timezone", toast: false });
  }

  function handleTimeFormatChange(value: "12h" | "24h") {
    setTimeFormat(value);
    saveProfile({ timeFormat: value }, { field: "timeFormat", toast: false });
  }

  function handleProfileVisibilityChange(value: "public" | "private") {
    setProfileVisibility(value);
    saveProfile(
      { profileVisibility: value },
      { field: "profileVisibility", toast: false }
    );
  }

  function saveSpokenLanguages(next: SpokenLanguage[]) {
    setSpokenLanguages(next);
    saveProfile({ spokenLanguages: next }, { field: "spokenLanguages", toast: false });
  }

  function addSpokenLanguage() {
    const usedLanguages = new Set(spokenLanguages.map((entry) => entry.language));
    const nextLanguage = SPOKEN_LANGUAGES.find(
      ({ value }) => !usedLanguages.has(value)
    )?.value;
    if (!nextLanguage) {
      toast.error(t`You have added all available languages.`);
      return;
    }
    saveSpokenLanguages([
      ...spokenLanguages,
      { language: nextLanguage, level: "professional_working" },
    ]);
  }

  function updateSpokenLanguage(
    index: number,
    field: "language" | "level",
    value: string
  ) {
    if (
      field === "language" &&
      spokenLanguages.some((entry, i) => i !== index && entry.language === value)
    ) {
      toast.error(t`You already added this language.`);
      return;
    }
    const next = spokenLanguages.map((entry, i) =>
      i === index
        ? {
            ...entry,
            [field]: field === "level" ? (value as SpokenLanguageLevel) : value,
          }
        : entry
    );
    saveSpokenLanguages(next);
  }

  function removeSpokenLanguage(index: number) {
    saveSpokenLanguages(spokenLanguages.filter((_, i) => i !== index));
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t`New passwords do not match.`);
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t`Password must be at least 8 characters.`);
      return;
    }

    setPasswordSaving(true);
    const result = await changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPasswordSaving(false);

    if (result.error) {
      toast.error(result.error.message ?? t`Could not change password.`);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success(t`Password updated.`);
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      toast.error(t`Enter your password to confirm deletion.`);
      return;
    }

    setDeleting(true);
    const result = await deleteUser({ password: deletePassword });
    setDeleting(false);

    if (result.error) {
      toast.error(result.error.message ?? t`Could not delete account.`);
      return;
    }

    window.location.href = "/";
  }

  if (userQuery.isLoading || !user) {
    return <div className="text-sm text-muted-foreground">{t`Loading...`}</div>;
  }

  const savedName = user.name;
  const savedHandle = user.username ?? "";

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="max-w-xl space-y-6">
        <div className="space-y-6">
          <Section
            title={t`Account`}
            description={t`Your public identity on Fable.`}
          >
            <InlineTextField
              label={t`Name`}
              description={t`Your display name shown across Fable.`}
              value={name}
              savedValue={savedName}
              onChange={setNameDraft}
              onUpdate={handleUpdateName}
              updating={updatingField === "name"}
              inputProps={{
                placeholder: t`Your name`,
                autoComplete: "name",
              }}
            />

            <InlineTextField
              label={t`Handle`}
              description={t`Your unique @handle. Lowercase letters, numbers, and underscores only.`}
              value={handle}
              savedValue={savedHandle}
              onChange={(value) => setHandleDraft(value.toLowerCase())}
              onUpdate={handleUpdateHandle}
              updating={updatingField === "handle"}
              inputProps={{
                placeholder: "your_handle",
                autoComplete: "username",
              }}
            />

            <FieldGroup label={t`Email`}>
              <Input
                value={user.email}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </FieldGroup>
          </Section>

          <Section title={t`Date & time`}>
            <FieldGroup label={t`Timezone`}>
              <SelectCombobox
                value={timezone}
                onValueChange={handleTimezoneChange}
                disabled={updatingField === "timezone"}
                options={TIMEZONES.map(({ value, label }) => ({ value, label }))}
              />
            </FieldGroup>

            <FieldGroup label={t`Time format`}>
              <SelectCombobox
                value={timeFormat}
                onValueChange={(value) =>
                  handleTimeFormatChange(value as "12h" | "24h")
                }
                disabled={updatingField === "timeFormat"}
                options={TIME_FORMATS.map(({ value, label }) => ({ value, label }))}
                searchable={false}
              />
            </FieldGroup>
          </Section>

          <Section
            title={t`Languages you speak`}
            description={t`Add languages and your proficiency level, similar to LinkedIn.`}
          >
            <div className="space-y-3">
              {spokenLanguages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t`No languages added yet.`}
                </p>
              )}
              {spokenLanguages.map((entry, index) => (
                <div key={index} className="flex items-start gap-2">
                  <SelectCombobox
                    value={entry.language}
                    onValueChange={(value) =>
                      updateSpokenLanguage(index, "language", value)
                    }
                    disabled={updatingField === "spokenLanguages"}
                    options={SPOKEN_LANGUAGES.filter(
                      ({ value }) =>
                        value === entry.language ||
                        !spokenLanguages.some(
                          (other, i) => i !== index && other.language === value
                        )
                    ).map(({ value, label }) => ({
                      value,
                      label,
                    }))}
                    triggerClassName="flex-1"
                  />
                  <SelectCombobox
                    value={entry.level}
                    onValueChange={(value) =>
                      updateSpokenLanguage(index, "level", value)
                    }
                    disabled={updatingField === "spokenLanguages"}
                    options={SPOKEN_LANGUAGE_LEVELS.map(({ value, label }) => ({
                      value,
                      label,
                    }))}
                    triggerClassName="flex-[1.5]"
                    searchable={false}
                  />
                  <button
                    type="button"
                    onClick={() => removeSpokenLanguage(index)}
                    disabled={updatingField === "spokenLanguages"}
                    className="mt-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    aria-label={t`Remove language`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addSpokenLanguage}
              disabled={
                updatingField === "spokenLanguages" ||
                spokenLanguages.length >= SPOKEN_LANGUAGES.length
              }
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t`Add language`}
            </button>
          </Section>

          <Section
            title={t`Profile privacy`}
            description={t`Control who can see your public profile.`}
          >
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/50">
                <input
                  type="radio"
                  name="profileVisibility"
                  value="private"
                  checked={profileVisibility === "private"}
                  onChange={() => handleProfileVisibilityChange("private")}
                  disabled={updatingField === "profileVisibility"}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">{t`Private`}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t`Only you can view your profile.`}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/50">
                <input
                  type="radio"
                  name="profileVisibility"
                  value="public"
                  checked={profileVisibility === "public"}
                  onChange={() => handleProfileVisibilityChange("public")}
                  disabled={updatingField === "profileVisibility"}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">{t`Public`}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t`Anyone can view your profile page.`}
                  </span>
                </span>
              </label>
            </div>
          </Section>
        </div>

        <form onSubmit={handleChangePassword}>
          <Section title={t`Password`}>
            <FieldGroup label={t`Current password`}>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </FieldGroup>
            <FieldGroup label={t`New password`}>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </FieldGroup>
            <FieldGroup label={t`Confirm new password`}>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </FieldGroup>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="secondary"
                disabled={passwordSaving || !currentPassword || !newPassword}
              >
                {passwordSaving ? t`Updating...` : t`Update password`}
              </Button>
            </div>
          </Section>
        </form>

        <section className="rounded-lg border border-destructive/30 bg-card p-6">
          <h2 className="text-sm font-semibold text-destructive">{t`Danger zone`}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t`Permanently delete your account and all associated data. This action cannot be undone.`}
          </p>

          {!showDeleteConfirm ? (
            <Button
              type="button"
              variant="destructive"
              className="mt-4"
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t`Delete account`}
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              <FieldGroup label={t`Confirm with your password`}>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder={t`Enter your password`}
                />
              </FieldGroup>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={handleDeleteAccount}
                >
                  {deleting ? t`Deleting...` : t`Confirm deletion`}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword("");
                  }}
                >
                  {t`Cancel`}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
