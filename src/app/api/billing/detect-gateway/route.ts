import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const country =
    request.headers.get("Cloudflare-IPCountry") ??
    request.headers.get("CF-IPCountry") ??
    "";

  const gateway = country === "IN" ? "razorpay" : "stripe";

  return Response.json({ gateway, country: country || null });
}
