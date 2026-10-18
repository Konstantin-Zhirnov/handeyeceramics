"use client";
import { useEffect, useState } from "react";

/**
 * The client link of an invoice with the three things the owner does with it
 * on a phone: copy it into a message, hand it to the phone's share sheet
 * (SMS, email, WhatsApp), or open it to see what the client sees.
 */
export function CopyLink({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // Known only in the browser: the server renders without Share, a phone adds it after hydration.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // An older browser or a page without clipboard rights: select the text so a long press copies it.
      const input = document.getElementById("he-invoice-url") as HTMLInputElement | null;
      input?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      /* the owner closed the share sheet */
    }
  }

  return (
    <div className="he-copy">
      <input id="he-invoice-url" className="he-copy__url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Client link" />
      <div className="he-copy__buttons">
        <button type="button" className="he-copy__btn he-copy__btn--main" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
        {canShare && (
          <button type="button" className="he-copy__btn" onClick={share}>
            Share
          </button>
        )}
        <a className="he-copy__btn" href={url} target="_blank" rel="noreferrer">
          Open
        </a>
      </div>
    </div>
  );
}
