"use client";

import dynamic from "next/dynamic";

const Navbar = dynamic(() => import("@/components/layout/Navbar"), { ssr: false });

export default function FindHomesLayout({
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
