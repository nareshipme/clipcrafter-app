"use client";
import { useEffect, useState } from "react";

type UsageData = {
  alphaExpiresInDays: number | null;
};

export default function AlphaExpiryBanner() {
  const [show, setShow] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dismissedKey = `alpha_banner_dismissed_${today}`;
    if (localStorage.getItem(dismissedKey)) return;

    fetch("/api/billing/usage")
      .then((r) => r.json())
      .then((d: UsageData) => {
        if (
          d.alphaExpiresInDays !== null &&
          d.alphaExpiresInDays > 0 &&
          d.alphaExpiresInDays <= 5
        ) {
          setDaysLeft(d.alphaExpiresInDays);
          setShow(true);
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`alpha_banner_dismissed_${today}`, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between gap-4 text-sm">
      <p className="text-amber-200">
        ⚡ Your alpha access expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}. Lock in founder
        pricing before it ends.
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="/dashboard/billing"
          className="rounded-md bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 font-semibold transition-colors"
        >
          Upgrade Now
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-amber-400 hover:text-amber-200 transition-colors leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
