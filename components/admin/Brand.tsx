/* The site's mark and wordmark in place of Payload's (admin.components.graphics); styled in app/(payload)/custom.scss. */
import { LogoMark } from "@/components/Logo";

/** The login page: the mark over the site's Didone wordmark. */
export function BrandLogo() {
  return (
    <span className="he-brand-logo">
      <LogoMark className="he-brand-logo__mark" />
      <span className="he-brand-logo__name">
        Hand Eye <span aria-hidden="true">/</span> Ceramics
      </span>
    </span>
  );
}

/** The header's home link (titled "Dashboard" by Payload): the mark alone. */
export function BrandIcon() {
  return <LogoMark className="he-brand-icon" />;
}
