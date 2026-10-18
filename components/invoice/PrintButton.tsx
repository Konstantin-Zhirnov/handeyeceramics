"use client";

/** Opens the browser's print dialog; "Save as PDF" is one of its printers. Hidden on paper. */
export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`print:hidden ${className}`}>
      Print or save as PDF
    </button>
  );
}
