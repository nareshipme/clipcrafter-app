import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api(.*)"]);
const isPublicApiRoute = createRouteMatcher([
  "/api/inngest(.*)", // Inngest dev server must reach this
  "/api/webhooks(.*)", // Clerk + Razorpay webhooks are self-authenticating
  "/api/health(.*)", // Health check endpoint — public, used by monitoring
]);
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Redirect signed-in users away from auth pages to dashboard
  if (userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Skip auth for public API routes (Inngest, webhooks)
  if (isPublicApiRoute(req)) return;

  // Protect dashboard, admin, and API routes
  if (isProtectedRoute(req) || isAdminRoute(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
