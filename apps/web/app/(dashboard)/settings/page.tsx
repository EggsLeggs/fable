"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input } from "@fable/ui";
import { changePassword, deleteUser } from "@fable/auth/client";
import type { SpokenLanguage, SpokenLanguageLevel } from "@fable/db";
import { trpc } from "@/lib/trpc/client";
import {
  SITE_LANGUAGES,
  SPOKEN_LANGUAGE_LEVELS,
  SPOKEN_LANGUAGES,
  TIME_FORMATS,
  TIMEZONES,
} from "@/lib/profile-constants";

type UpdateProfileInput = {
  name?: string;
  username?: string | null;
  timezone?: string;
  timeFormat?: "12h" | "24h";
  siteLocale?: string;
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
            {updating ? "Updating..." : "Update"}
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
  const [usernameDraft, setUsernameDraft] = useState<string | undefined>(
    undefined
  );
  const username = usernameDraft ?? user?.username ?? "";
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
    setUsernameDraft(undefined);
  }, [user]);

  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onError: (err) => toast.error(err.message ?? "Could not update profile."),
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
          setUsernameDraft(undefined);
        }
        if (options.refresh) {
          router.refresh();
        }
        if (options.toast !== false) {
          toast.success("Updated.");
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
      toast.error("Name cannot be empty.");
      return;
    }
    saveProfile({ name: trimmed }, { field: "name", refresh: true });
  }

  function handleUpdateUsername() {
    const normalized = username.trim().toLowerCase();
    if (normalized && !/^[a-z0-9_]{3,30}$/.test(normalized)) {
      toast.error(
        "Username must be 3-30 characters and use only lowercase letters, numbers, and underscores."
      );
      return;
    }
    saveProfile(
      { username: normalized === "" ? null : normalized },
      { field: "username", refresh: true }
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
    saveSpokenLanguages([
      ...spokenLanguages,
      { language: "en", level: "professional_working" },
    ]);
  }

  function updateSpokenLanguage(
    index: number,
    field: "language" | "level",
    value: string
  ) {
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
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
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
      toast.error(result.error.message ?? "Could not change password.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password updated.");
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      toast.error("Enter your password to confirm deletion.");
      return;
    }

    setDeleting(true);
    const result = await deleteUser({ password: deletePassword });
    setDeleting(false);

    if (result.error) {
      toast.error(result.error.message ?? "Could not delete account.");
      return;
    }

    window.location.href = "/";
  }

  if (userQuery.isLoading || !user) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  const savedName = user.name;
  const savedUsername = user.username ?? "";

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="max-w-xl space-y-6">
        <div className="space-y-6">
          <Section
            title="Account"
            description="Your public identity on Fable."
          >
            <InlineTextField
              label="Name"
              description="Your display name shown across Fable."
              value={name}
              savedValue={savedName}
              onChange={setNameDraft}
              onUpdate={handleUpdateName}
              updating={updatingField === "name"}
              inputProps={{
                placeholder: "Your name",
                autoComplete: "name",
              }}
            />

            <InlineTextField
              label="Username"
              description="Lowercase letters, numbers, and underscores only."
              value={username}
              savedValue={savedUsername}
              onChange={(value) => setUsernameDraft(value.toLowerCase())}
              onUpdate={handleUpdateUsername}
              updating={updatingField === "username"}
              inputProps={{
                placeholder: "your_username",
                autoComplete: "username",
              }}
            />

            <FieldGroup label="Email">
              <Input
                value={user.email}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </FieldGroup>
          </Section>

          <Section title="Preferences">
            <FieldGroup
              label="Site language"
              description="More languages coming soon."
            >
              <select
                value="en"
                disabled
                className="input bg-muted text-muted-foreground"
              >
                {SITE_LANGUAGES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Timezone">
              <select
                value={timezone}
                onChange={(e) => handleTimezoneChange(e.target.value)}
                disabled={updatingField === "timezone"}
                className="input"
              >
                {TIMEZONES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Time format">
              <select
                value={timeFormat}
                onChange={(e) =>
                  handleTimeFormatChange(e.target.value as "12h" | "24h")
                }
                disabled={updatingField === "timeFormat"}
                className="input"
              >
                {TIME_FORMATS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FieldGroup>
          </Section>

          <Section
            title="Languages you speak"
            description="Add languages and your proficiency level, similar to LinkedIn."
          >
            <div className="space-y-3">
              {spokenLanguages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No languages added yet.
                </p>
              )}
              {spokenLanguages.map((entry, index) => (
                <div key={index} className="flex items-start gap-2">
                  <select
                    value={entry.language}
                    onChange={(e) =>
                      updateSpokenLanguage(index, "language", e.target.value)
                    }
                    disabled={updatingField === "spokenLanguages"}
                    className="input flex-1"
                  >
                    {SPOKEN_LANGUAGES.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={entry.level}
                    onChange={(e) =>
                      updateSpokenLanguage(index, "level", e.target.value)
                    }
                    disabled={updatingField === "spokenLanguages"}
                    className="input flex-[1.5]"
                  >
                    {SPOKEN_LANGUAGE_LEVELS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeSpokenLanguage(index)}
                    disabled={updatingField === "spokenLanguages"}
                    className="mt-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    aria-label="Remove language"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addSpokenLanguage}
              disabled={updatingField === "spokenLanguages"}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add language
            </button>
          </Section>

          <Section
            title="Profile privacy"
            description="Control who can see your public profile."
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
                  <span className="block text-sm font-medium">Private</span>
                  <span className="block text-xs text-muted-foreground">
                    Only you can view your profile.
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
                  <span className="block text-sm font-medium">Public</span>
                  <span className="block text-xs text-muted-foreground">
                    Anyone can view your profile page.
                  </span>
                </span>
              </label>
            </div>
          </Section>
        </div>

        <form onSubmit={handleChangePassword}>
          <Section title="Password">
            <FieldGroup label="Current password">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </FieldGroup>
            <FieldGroup label="New password">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </FieldGroup>
            <FieldGroup label="Confirm new password">
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
                {passwordSaving ? "Updating..." : "Update password"}
              </Button>
            </div>
          </Section>
        </form>

        <section className="rounded-lg border border-destructive/30 bg-card p-6">
          <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <Button
              type="button"
              variant="destructive"
              className="mt-4"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete account
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              <FieldGroup label="Confirm with your password">
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
              </FieldGroup>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={handleDeleteAccount}
                >
                  {deleting ? "Deleting..." : "Confirm deletion"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
