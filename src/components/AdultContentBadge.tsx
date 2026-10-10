import type { HTMLAttributes } from "react";

type AdultContentBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children">;

/**
 * Visible age-rating marker for metadata that has already been classified
 * as adult-only. This component only labels content; it does not expose,
 * fetch, or recommend adult material.
 */
export function AdultContentBadge({
  className = "",
  ...props
}: AdultContentBadgeProps) {
  return (
    <span
      role="note"
      aria-label="Contenu réservé aux adultes, 18 ans et plus"
      title="Contenu réservé aux adultes (18+)"
      className={`inline-flex shrink-0 items-center rounded-md border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-red-500 ${className}`.trim()}
      {...props}
    >
      +18
    </span>
  );
}
