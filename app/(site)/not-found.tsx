import Link from "next/link";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";

export const metadata = { title: "Page not found | Hand Eye Ceramics", description: "This page does not exist. See our pottery classes in Vancouver and Nanaimo." };

export default function NotFound() {
  return (
    <SiteShell>
      <PageHeading title="Page not found">
        <p className="mt-4 text-ink-soft">
          This page doesn&apos;t exist. <Link className="underline" href="/">Go to the home page</Link>.
        </p>
      </PageHeading>
    </SiteShell>
  );
}
