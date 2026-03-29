const ADMIN_CLERK_IDS = new Set([
  "user_3BX48H64saGkHumzh3Ki76AZ8xs",
  "user_3BURpRvDaPzZPFmiUAKBJtTDGnT",
]);

export function isAdmin(clerkUserId: string | null | undefined): boolean {
  if (!clerkUserId) return false;
  return ADMIN_CLERK_IDS.has(clerkUserId);
}
