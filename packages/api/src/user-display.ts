export function getMemberDisplayName(user: {
  name?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  return user.name ?? user.email ?? (user.username ? `@${user.username}` : "Unknown");
}
