import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/billing";

export async function GET() {
  const plans = [
    {
      id: "free",
      name: "Free",
      price: PLAN_PRICES.free,
      audioMinutesPerMonth: PLAN_LIMITS.free,
      features: [
        "30 minutes of audio per month",
        "AI highlight extraction",
        "Export clips",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      price: PLAN_PRICES.pro,
      audioMinutesPerMonth: PLAN_LIMITS.pro,
      features: [
        "600 minutes of audio per month",
        "AI highlight extraction",
        "Export clips",
        "Priority processing",
      ],
    },
    {
      id: "team",
      name: "Team",
      price: PLAN_PRICES.team,
      audioMinutesPerMonth: null, // unlimited
      features: [
        "Unlimited audio",
        "AI highlight extraction",
        "Export clips",
        "Priority processing",
        "Team collaboration",
      ],
    },
  ];

  return Response.json({ plans });
}
