import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Karla } from "next/font/google";
import { Tracking } from "@/components/site/Tracking";
import { getHome } from "@/lib/cms/site";
import { SITE_URL } from "@/lib/cms/text";
import "../globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
});

/** The fallback title and description are the home page's, from the CMS; each template sets its own. */
export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getHome();
  return {
    metadataBase: new URL(SITE_URL),
    ...(seo.title ? { title: seo.title } : {}),
    ...(seo.description ? { description: seo.description } : {}),
    // The same mark the admin uses (payload.config.ts admin.meta.icons).
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "32x32 16x16" },
      ],
      apple: { url: "/assets/apple-touch-icon.png", sizes: "180x180" },
    },
  };
}

// width=device-width + no user-scaling lock: the page fits the phone,
// and people who still want to zoom are allowed to.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#f5efe6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // data-scroll-behavior: Next 16 turns the smooth scrolling of globals.css off only when asked to;
  // left on, its scroll to the new page on a link animates and stops at the footer on a phone.
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${bodoni.variable} ${karla.variable}`}>
      <body>
        {children}
        <Tracking />
      </body>
    </html>
  );
}
