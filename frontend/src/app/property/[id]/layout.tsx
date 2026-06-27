import Navbar from "@/components/layout/Navbar";

export default function PropertyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar variant="sticky" />
      {children}
    </>
  );
}
