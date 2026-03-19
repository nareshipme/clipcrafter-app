import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

Feature("Supabase User Sync", () => {
  Scenario("User record structure is valid", () => {
    it("Given a clerk user object, Then it maps to the correct DB shape", () => {
      const clerkUser = {
        id: "user_clerk_123",
        emailAddresses: [{ emailAddress: "test@example.com" }],
        firstName: "Test",
        lastName: "User",
      };

      const dbUser = mapClerkUserToDb(clerkUser);

      expect(dbUser).toMatchObject({
        clerk_id: "user_clerk_123",
        email: "test@example.com",
        full_name: "Test User",
        plan: "free",
        credits: 30,
      });
    });

    it("Given a clerk user with no last name, Then full_name uses first name only", () => {
      const clerkUser = {
        id: "user_clerk_456",
        emailAddresses: [{ emailAddress: "solo@example.com" }],
        firstName: "Solo",
        lastName: null,
      };

      const dbUser = mapClerkUserToDb(clerkUser);
      expect(dbUser.full_name).toBe("Solo");
    });
  });
});

// Import will fail until implemented — intentional RED
function mapClerkUserToDb(clerkUser: any) {
  const { mapClerkUserToDb } = require("@/lib/auth-sync");
  return mapClerkUserToDb(clerkUser);
}
