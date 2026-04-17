import type { Metadata } from "next";
import { Barlow, Space_Mono, Syne } from "next/font/google";
import "../styles/globals.css";
import { Starfield } from "@/components/shared/starfield";
import { TopNav } from "@/components/shared/top-nav";

const displayFont = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

const monoFont = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

const bodyFont = Barlow({
  subsets: ["latin"],
  variable: "--font-body",
  style: ["normal", "italic"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Bluespace",
  description: "Hackathon 3D print request platform",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${displayFont.variable} ${monoFont.variable} ${bodyFont.variable} font-body`}
      >
        <div className="relative min-h-screen overflow-hidden bg-space-900">
          <Starfield density={280} />
          <div className="pointer-events-none absolute inset-0 bg-mesh" />
          <div className="pointer-events-none absolute inset-0 bg-circuit-grid bg-[length:40px_40px] opacity-25" />
          <div className="pointer-events-none absolute -left-24 top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-nebula-radial blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-[-10rem] h-[30rem] w-[30rem] rounded-full bg-nebula-radial opacity-80 blur-3xl" />
          <div className="scanline-overlay pointer-events-none absolute inset-0" />
          <TopNav />
          <main className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
