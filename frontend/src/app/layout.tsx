import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/providers/Providers";
import ChatbotConditional from "@/components/layout/ChatbotConditional";

export const metadata: Metadata = {
  title: "Axiom — Find Your Vibe",
  description:
    "AI-powered real estate platform in Egypt. Find homes, roommates, and rentals that match your lifestyle.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen">
        <Providers>
          {children}
          <ChatbotConditional />
        </Providers>
      </body>
    </html>
  );
}
 