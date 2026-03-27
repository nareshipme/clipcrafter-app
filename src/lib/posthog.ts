import PostHog from "posthog-js";

export function initPostHog() {
  if (typeof window !== "undefined") {
    PostHog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false, // we handle manually
      capture_pageleave: true,
    });
  }
  return PostHog;
}
export { PostHog as posthog };
