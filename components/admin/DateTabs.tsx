"use client";
import { useListQuery } from "@payloadcms/ui";
import type { Where } from "payload";
import { addDays, startOfDay } from "../../lib/time";
import { upcomingWindow } from "./upcoming";

const PAST_DAYS = 14;

type Tab = { key: string; label: string; where?: Where };

/** The tab a list filter is: none — from today; a bound below today — the past; only "has a first day" — all. A filter the editor built by hand is no tab. */
function tabOf(where: Where | undefined): string {
  if (!where || !Object.keys(where).length) return "upcoming";
  const and = (Array.isArray(where.and) ? where.and : []) as Record<string, Record<string, unknown> | undefined>[];
  if (and.some((c) => c.startsAt && "less_than" in c.startsAt)) return "past";
  if (and.length === 1 && and[0].startsAt && "exists" in and[0].startsAt) return "all";
  return "";
}

/**
 * Above the list of class dates: which dates it shows. Without a filter of
 * its own the list shows the dates from today on (the `baseFilter` of the
 * sessions collection); the other tabs set an explicit filter on the first
 * day through the list's own query, so paging and sorting keep it.
 */
export function DateTabs() {
  const { query, refineListData } = useListQuery();
  const { today, from } = upcomingWindow(new Date());
  const pastFrom = startOfDay(addDays(today, -PAST_DAYS))!;
  const tabs: Tab[] = [
    { key: "upcoming", label: "From today" },
    {
      key: "past",
      label: `Past ${PAST_DAYS} days`,
      where: { and: [{ startsAt: { greater_than_equal: pastFrom.toISOString() } }, { startsAt: { less_than: from.toISOString() } }] },
    },
    { key: "all", label: "All dates", where: { and: [{ startsAt: { exists: true } }] } },
  ];
  const current = tabOf(query?.where);
  return (
    <nav aria-label="Which dates" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px" }}>
      {tabs.map((t) => {
        const on = current === t.key;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={on}
            onClick={() => void refineListData({ where: t.where, sort: "startsAt", page: 1 })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 36,
              padding: "0 14px",
              borderRadius: 18,
              fontSize: 14,
              cursor: "pointer",
              border: "1px solid var(--theme-elevation-150)",
              background: on ? "var(--theme-elevation-800)" : "var(--theme-elevation-0)",
              color: on ? "var(--theme-elevation-0)" : "var(--theme-elevation-800)",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
