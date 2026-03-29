import AlphaExpiryBanner from "@/components/AlphaExpiryBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AlphaExpiryBanner />
      {children}
    </>
  );
}
