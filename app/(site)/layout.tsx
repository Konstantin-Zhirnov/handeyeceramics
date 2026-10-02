import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Karla } from "next/font/google";
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
  return (
    <html lang="en" className={`${bodoni.variable} ${karla.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
