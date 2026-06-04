import { createHash } from "node:crypto";

export function gravatarUrl(email: string, size = 56): string {
  const normalized = email.trim().toLowerCase();
  const hash = createHash("md5").update(normalized).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}

export function resolveUserAvatarUrl(
  image: string | null | undefined,
  email: string,
  size = 56,
): string | null {
  if (image) return image;
  if (email) return gravatarUrl(email, size);
  return null;
}
