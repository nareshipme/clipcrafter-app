export default function PricingPage() {
  const tiers = [
    {
      name: "Free",
      price: "₹0",
      description: "Get started with basic access.",
      features: ["30 min/month processing", "Up to 3 projects", "Basic highlight extraction"],
      cta: "Get Started",
      ctaHref: "/sign-up",
      highlighted: false,
    },
    {
      name: "Free Trial",
      price: "₹0",
      description: "Try everything free for 30 days.",
      features: [
        "Unlimited processing for 30 days",
        "All highlights & clips",
        "Full export options",
        "No credit card required",
      ],
      cta: "Start Free Trial",
      ctaAction: "start-trial",
      highlighted: true,
    },
    {
      name: "Starter",
      price: "₹TBD",
      description: "For creators publishing regularly.",
      features: [
        "5 hrs/month processing",
        "Unlimited projects",
        "Priority processing",
        "Email support",
      ],
      cta: "Coming Soon",
      ctaDisabled: true,
      highlighted: false,
    },
    {
      name: "Pro",
      price: "₹TBD",
      description: "For power users and teams.",
      features: [
        "20 hrs/month processing",
        "Unlimited projects",
        "Fastest processing",
        "Priority support",
      ],
      cta: "Coming Soon",
      ctaDisabled: true,
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-gray-400 text-lg">All prices in INR. Powered by Razorpay.</p>
          <p className="text-gray-500 text-sm mt-2">
            Note: Razorpay integration for paid plans coming soon. Starter &amp; Pro prices TBD.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border p-6 flex flex-col gap-4 ${
                tier.highlighted
                  ? "border-violet-500 bg-violet-950/30"
                  : "border-gray-800 bg-gray-900"
              }`}
            >
              <div>
                <h2 className="text-xl font-bold">{tier.name}</h2>
                <p className="text-3xl font-bold mt-1">
                  {tier.price}
                  {tier.price !== "₹0" && tier.price !== "₹TBD" && (
                    <span className="text-sm font-normal text-gray-400">/mo</span>
                  )}
                </p>
                <p className="text-sm text-gray-400 mt-2">{tier.description}</p>
              </div>

              <ul className="flex-1 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-violet-400 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {"ctaAction" in tier ? (
                <StartTrialButton />
              ) : (
                <a
                  href={tier.ctaHref ?? "#"}
                  aria-disabled={tier.ctaDisabled}
                  className={`block text-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                    tier.ctaDisabled
                      ? "bg-gray-800 text-gray-500 cursor-not-allowed pointer-events-none"
                      : tier.highlighted
                        ? "bg-violet-600 hover:bg-violet-500"
                        : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {tier.cta}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StartTrialButton() {
  // Inline client interaction — redirect to dashboard which handles start-trial
  return (
    <a
      href="/dashboard"
      className="block text-center rounded-lg px-4 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-500 transition-colors"
    >
      Start Free Trial
    </a>
  );
}
