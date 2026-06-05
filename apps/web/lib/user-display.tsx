export type UserLike = {
  name?: string | null;
  email?: string | null;
  username?: string | null;
};

export function getUserPrimaryLabel(user: UserLike): string {
  return user.name?.trim() || user.email || "Unknown";
}

export function getUserAvatarLabel(user: UserLike): string {
  return getUserPrimaryLabel(user);
}

export function formatUserOptionLabel(user: UserLike): string {
  const primary = getUserPrimaryLabel(user);
  if (user.username) {
    return `${primary} (@${user.username})`;
  }
  return primary;
}

type UserDisplayNameProps = {
  user: UserLike;
  className?: string;
  primaryClassName?: string;
  handleClassName?: string;
};

export function UserDisplayName({
  user,
  className,
  primaryClassName,
  handleClassName = "font-normal text-muted-foreground",
}: UserDisplayNameProps) {
  const primary = getUserPrimaryLabel(user);

  return (
    <span className={className}>
      <span className={primaryClassName}>{primary}</span>
      {user.username ? (
        <span className={handleClassName}> @{user.username}</span>
      ) : null}
    </span>
  );
}
