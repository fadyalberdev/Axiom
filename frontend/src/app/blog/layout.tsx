import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar variant="overlay" />
      <main className="flex-grow">{children}</main>
      <Footer />
    </>
  );
}
