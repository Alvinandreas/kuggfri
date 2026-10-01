"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isOriginFilter, isReviewTab, type ReviewArea, type ReviewFilter, type ReviewTab } from "@/lib/admin/review";
import { isSourceFilter } from "@/lib/admin/sources";
import { isCardKind } from "@/lib/cards/kinds";

export type View = { tab: ReviewTab; cardId: string | null; filter: ReviewFilter };

/** Flik, öppet kort och filter ur adressen. */
function parseView(params: URLSearchParams, areaIds: Set<string>): View {
  const tab = params.get("flik");
  const area = params.get("omrade") ?? "alla";
  const kind = params.get("typ");
  const source = params.get("kalla");
  const origin = params.get("ursprung");
  return {
    tab: isReviewTab(tab) ? tab : "att-granska",
    cardId: params.get("kort") || null,
    filter: {
      area: area === "ingen" || areaIds.has(area) ? area : "alla",
      kind: isCardKind(kind) ? kind : "alla",
      source: isSourceFilter(source) ? source : "alla",
      origin: isOriginFilter(origin) ? origin : "alla",
      query: params.get("sok") ?? "",
    },
  };
}

export function viewQuery(v: View): string {
  const q = new URLSearchParams();
  if (v.tab !== "att-granska") q.set("flik", v.tab);
  if (v.cardId) q.set("kort", v.cardId);
  if (v.filter.area !== "alla") q.set("omrade", v.filter.area);
  if (v.filter.kind !== "alla") q.set("typ", v.filter.kind);
  if (v.filter.source !== "alla") q.set("kalla", v.filter.source);
  if (v.filter.origin !== "alla") q.set("ursprung", v.filter.origin);
  if (v.filter.query.trim()) q.set("sok", v.filter.query);
  const s = q.toString();
  return s ? `?${s}` : "";
}

type Options = {
  areas: ReviewArea[];
  /** Pågående beslut per kort (useOptimisticDecisions): adressen väntar tills inget är på väg. */
  inFlight: RefObject<Map<string, number>>;
  /** Antal beslut som ännu inte sparats; när det blir 0 skrivs en väntande adress. */
  saving: number;
};

/**
 * Inkorgens vy (flik, öppet kort och filter) och sökrutan, i takt med adressen.
 *
 * Vyn hålls i ett eget tillstånd som skrivs till adressen samtidigt (navigate), så att ett
 * beslut och bytet till nästa kort renderas i samma svep. Adressen läses tillbaka när den
 * ändras utifrån: bakåtknappen, eller en länk hit från sidomenyn eller innehållsöversikten.
 */
export function useReviewView({ areas, inFlight, saving }: Options) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const areaIds = useMemo(() => new Set(areas.map((a) => a.id)), [areas]);
  const [view, setView] = useState<View>(() => parseView(new URLSearchParams(searchParams.toString()), areaIds));
  useEffect(() => {
    const sync = () => {
      const fromUrl = parseView(new URLSearchParams(window.location.search), areaIds);
      setView((v) => (viewQuery(v) === viewQuery(fromUrl) ? v : fromUrl));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [searchParams, areaIds]);

  const [query, setQuery] = useState(view.filter.query);

  // Sökrutan följer adressen (bakåtknappen), men skriver man i den gäller det man skriver.
  useEffect(() => {
    setQuery((q) => (q === view.filter.query ? q : view.filter.query));
  }, [view.filter.query]);

  // Adressen skrivs först när inga beslut sparas: ändras adressen medan ett beslut är på väg
  // avbryter Next förfrågan, och beslutet når aldrig tillbaka hit. Vyn byter kort direkt ändå.
  const pendingUrl = useRef<{ url: string; mode: "push" | "replace" } | null>(null);
  const writeUrl = useCallback((url: string, mode: "push" | "replace") => {
    if (url === `${window.location.pathname}${window.location.search}`) return;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  const navigate = useCallback(
    (next: Partial<View>, mode: "push" | "replace" = "push") => {
      const v: View = { ...view, ...next, filter: { ...view.filter, ...next.filter } };
      setView(v);
      const url = `${pathname}${viewQuery(v)}`;
      // Nästa tick: ett beslut som fattas i samma klick har då hunnit markeras som pågående.
      window.setTimeout(() => {
        const busy = [...inFlight.current.values()].some((n) => n > 0);
        if (busy) pendingUrl.current = { url, mode: pendingUrl.current?.mode === "push" ? "push" : mode };
        else writeUrl(url, mode);
      }, 0);
    },
    // inFlight är samma ref under hela komponentens liv.
    [pathname, view, writeUrl, inFlight],
  );

  useEffect(() => {
    if (saving > 0 || !pendingUrl.current) return;
    const { url, mode } = pendingUrl.current;
    pendingUrl.current = null;
    writeUrl(url, mode);
  }, [saving, writeUrl]);

  // Sökningen skrivs till adressen när man slutat skriva en stund.
  useEffect(() => {
    if (query === view.filter.query) return;
    const t = window.setTimeout(() => navigate({ filter: { ...view.filter, query } }, "replace"), 250);
    return () => window.clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  return { pathname, view, navigate, query, setQuery };
}
