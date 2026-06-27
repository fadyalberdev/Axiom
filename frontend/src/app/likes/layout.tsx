import Navbar from "@/components/layout/Navbar";

export default function LikesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar variant="sticky" />
      <div className="min-h-[calc(100vh-4rem)]">{children}</div>
    </>
  );
}
