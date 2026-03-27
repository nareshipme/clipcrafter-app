import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

const mockFrom = vi.fn();

// Mock supabase to avoid needing real credentials
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}));

Feature("Supabase User Sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("User record structure is valid", () => {
    it("Given a clerk user object, Then it maps to the correct DB shape", async () => {
      const clerkUser = {
        id: "user_clerk_123",
        emailAddresses: [{ emailAddress: "test@example.com" }],
        firstName: "Test",
        lastName: "User",
      };

      const { mapClerkUserToDb } = await import("@/lib/auth-sync");
      const dbUser = mapClerkUserToDb(clerkUser);

      expect(dbUser).toMatchObject({
        clerk_id: "user_clerk_123",
        email: "test@example.com",
        full_name: "Test User",
        plan: "free",
        credits: 30,
      });
    });

    it("Given a clerk user with no last name, Then full_name uses first name only", async () => {
      const clerkUser = {
        id: "user_clerk_456",
        emailAddresses: [{ emailAddress: "solo@example.com" }],
        firstName: "Solo",
        lastName: null,
      };

      const { mapClerkUserToDb } = await import("@/lib/auth-sync");
      const dbUser = mapClerkUserToDb(clerkUser);
      expect(dbUser.full_name).toBe("Solo");
    });
  });

  Scenario("upsertUserFromClerk syncs user to Supabase", () => {
    it("Given a valid clerk user, Then upserts to the users table", async () => {
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const { upsertUserFromClerk } = await import("@/lib/auth-sync");
      await expect(
        upsertUserFromClerk({
          id: "clerk_abc",
          emailAddresses: [{ emailAddress: "test@example.com" }],
          firstName: "Test",
          lastName: "User",
        })
      ).resolves.toBeUndefined();

      expect(mockFrom).toHaveBeenCalledWith("users");
    });

    it("Given a DB error, Then throws with error message", async () => {
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: "unique violation" } }),
      });

      const { upsertUserFromClerk } = await import("@/lib/auth-sync");
      await expect(
        upsertUserFromClerk({
          id: "clerk_abc",
          emailAddresses: [{ emailAddress: "test@example.com" }],
          firstName: "Test",
        })
      ).rejects.toThrow("unique violation");
    });
  });

  Scenario("getUserByClerkId fetches user from Supabase", () => {
    it("Given a valid clerk ID, Then returns the user row", async () => {
      const mockUser = { id: "db_1", clerk_id: "clerk_abc", email: "test@example.com" };
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
          }),
        }),
      });

      const { getUserByClerkId } = await import("@/lib/auth-sync");
      const user = await getUserByClerkId("clerk_abc");
      expect(user).toMatchObject({ clerk_id: "clerk_abc" });
    });

    it("Given a DB error, Then throws with error message", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
          }),
        }),
      });

      const { getUserByClerkId } = await import("@/lib/auth-sync");
      await expect(getUserByClerkId("clerk_missing")).rejects.toThrow("Not found");
    });
  });
});
