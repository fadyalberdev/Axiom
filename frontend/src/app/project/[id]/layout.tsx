import Navbar from "@/components/layout/Navbar";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar variant="sticky" />
      <main className="flex-1 w-full">{children}</main>
    </>
  );
}
