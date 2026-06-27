import Link from "next/link";
import { Home, Headset, Building2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar variant="sticky" />
      <main
        className="flex-grow flex items-center justify-center relative overflow-hidden bg-cover bg-center pt-20"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(18,18,18,0.8), rgba(18,18,18,0.95)), url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2400&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background-dark/50 via-background-dark/80 to-background-dark" />

        <div className="relative z-10 max-w-6xl w-full px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            {/* Left — giant 404 */}
            <div className="text-center lg:text-left">
              <div className="mb-4">
                <h1
                  className="text-[100px] md:text-[150px] lg:text-[180px] font-extrabold text-white leading-none tracking-tighter opacity-90"
                  style={{
                    textShadow:
                      "0 0 20px rgba(255,90,60,0.3), 0 0 40px rgba(255,90,60,0.1)",
                  }}
                >
                  404
                </h1>
                <div className="w-24 h-1 bg-primary mx-auto lg:mx-0 -mt-2 md:-mt-4 rounded-full" />
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight">
                Oops! This home is off the market.
              </h2>
            </div>

            {/* Right — message + CTAs */}
            <div className="flex flex-col gap-8">
              <p className="text-gray-400 text-lg md:text-xl font-light leading-relaxed">
                The page you are looking for might have been moved or
                doesn&apos;t exist anymore.
              </p>

              <div className="flex flex-col gap-4 w-full max-w-md">
                <Link
                  href="/"
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 px-10 rounded-xl transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-3"
                >
                  <Home className="h-5 w-5" />
                  Back to Home
                </Link>
                <Link
                  href="/about"
                  className="w-full bg-transparent border border-white/20 hover:border-white/40 hover:bg-white/5 text-white font-bold py-4 px-10 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  <Headset className="h-5 w-5" />
                  Contact Support
                </Link>
              </div>

              <div className="hidden lg:block opacity-20 mt-4">
                <Building2 className="h-16 w-16 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
