import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api(.*)"]);
const isPublicApiRoute = createRouteMatcher([
  "/api/inngest(.*)", // Inngest dev server must reach this
  "/api/webhooks(.*)", // Clerk webhooks are self-authenticating
  "/api/billing/webhook/(.*)", // Stripe and Razorpay webhooks — signature-verified, no Clerk auth
  "/api/billing/plans(.*)", // Public plan definitions
  "/api/billing/detect-gateway(.*)", // Public gateway detection
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

  // Protect dashboard and API routes
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
