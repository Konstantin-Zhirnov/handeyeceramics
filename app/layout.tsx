import type { Metadata, Viewport } from "next";
import { Fraunces, Karla } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hand Eye Ceramics — Pottery classes in Vancouver, 7 days a week",
  description:
    "Beginner-friendly wheel throwing and hand building classes in Chinatown, Mt Pleasant and Nanaimo. Six-week courses, drop-ins, date nights and 24/7 studio memberships.",
};

// width=device-width + no user-scaling lock: the page fits the phone,
// and people who still want to zoom are allowed to.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#abd9f5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${karla.variable}`}>
      <body>{children}</body>
    </html>
  );
}
