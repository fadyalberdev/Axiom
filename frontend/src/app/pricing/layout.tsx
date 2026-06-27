import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar variant="sticky" />
      {children}
      <Footer />
    </>
  );
}
