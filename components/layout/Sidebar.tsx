"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChartNoAxesColumn,
  ChevronsLeft,
  CircleHelp,
  ClipboardCheck,
  ClipboardPen,
  Flag,
  House,
  Info,
  Layers,
  LayoutDashboard,
  LayoutList,
  Library,
  Lock,
  Menu as MenuIcon,
  Palette,
  ScrollText,
  Settings2,
  ShieldCheck,
  Upload,
  X,
  type LucideProps,
} from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { AdminNavDeck } from "@/lib/admin/nav";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Logo } from "@/components/layout/Logo";
import { ProfileMenu, type ShellUser } from "@/components/layout/ProfileMenu";

type NavLink = {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
  /** Aktiv bara på exakt href (och also), inte på undersidor. */
  exact?: boolean;
  /** Fler sökvägar där posten räknas som aktiv, med undersidor. */
  also?: string[];
  /** Räknare till höger (utkast, öppna felrapporter); 0 visas inte. */
  badge?: number;
  /** Vad räknaren betyder, i tooltip och skärmläsartext. */
  badgeLabel?: string;
  /** Låst för användaren (tentaläget före examinatorns öppning): låsikon och "låst" i namnet. */
  locked?: boolean;
  lockedLabel?: string;
  testId?: string;
};

export type SidebarProps = {
  user: ShellUser;
  /**
   * Kursen adminposterna gäller: låst till Materialteknik (lib/admin/active-course.ts).
   * null = inga adminflikar.
   */
  adminDeck: AdminNavDeck | null;
  /** Id för kurserna användaren får redigera (för låset på Tentaläget). */
  adminDeckIds: string[];
  /** Global admin: ser också Alla kurser och designsystemet. */
  isAdmin: boolean;
  /**
   * Publicerade kurser. Med en enda kurs pekar menyn direkt på den (Kurssidan och Tentaläget)
   * i stället för på Kurser. examModeOpen: tentaläget öppet för studenterna.
   */
  courses: { id: string; slug: string; title: string; examModeOpen: boolean }[];
};

const SIDEBAR_KEY = "kuggfri:sidebar";

function under(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function isActive(pathname: string, link: NavLink): boolean {
  const own = link.exact ? pathname === link.href : under(pathname, link.href);
  return own || (link.also ?? []).some((p) => under(pathname, p));
}

function NavItem({ link, pathname, drawer }: { link: NavLink; pathname: string; drawer?: boolean }) {
  const active = isActive(pathname, link);
  const Icon = link.icon;
  const badge = link.badge ?? 0;
  const label = link.locked && link.lockedLabel ? link.lockedLabel : badge > 0 && link.badgeLabel ? `${link.label}, ${link.badgeLabel}` : link.label;
  return (
    <Link
      href={link.href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      data-testid={link.testId}
      data-locked={link.locked ? "true" : undefined}
      className={cx(
        "nav-item flex items-center gap-3 rounded-md px-3 text-[0.95rem] font-medium transition-colors duration-150",
        // I mobilens meny trycks posterna med tummen: 44 px höga.
        drawer ? "h-11" : "h-10",
        active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <span className="relative inline-flex shrink-0">
        <Icon size={19} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
        {/* Hopfälld sidomeny: räknaren blir en prick på ikonen (antalet står i tooltipen). */}
        {badge > 0 && !drawer ? (
          <span data-sidebar-collapsed-only aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-accent" />
        ) : null}
        {/* Hopfälld sidomeny: låset blir ett litet märke på ikonen. */}
        {link.locked && !drawer ? (
          <span data-sidebar-collapsed-only aria-hidden className="absolute -bottom-1 -right-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sidebar">
            <Lock size={10} strokeWidth={2.6} />
          </span>
        ) : null}
      </span>
      <span data-sidebar-label className="min-w-0 flex-1 truncate">
        {link.label}
      </span>
      {badge > 0 ? (
        <span
          data-sidebar-label
          aria-hidden
          className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold tabular-nums text-accent-fg"
        >
          {badge}
        </span>
      ) : null}
      {link.locked ? <Lock data-sidebar-label size={15} strokeWidth={2} aria-hidden className="shrink-0 text-subtle" /> : null}
    </Link>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p data-sidebar-label className="px-3 pb-1.5 pt-5 text-xs font-semibold text-subtle">
      {children}
    </p>
  );
}

/**
 * Kursens adminsidor. Sidomenyn är den enda navigeringen mellan dem (kurssidorna har ingen
 * egen flikrad sedan 30 sep); områdes- och kortsidorna räknas till Innehåll. Posterna leder
 * alltid till den låsta kursen (Materialteknik, beslut 30 sep), och inget kursnamn står under
 * rubriken. Bara admin får Alla kurser (adminstartsidan, där Ny kurs finns) och designsystemet.
 */
function adminLinks(deck: AdminNavDeck | null, isAdmin: boolean): NavLink[] {
  const links: NavLink[] = [];
  if (deck) {
    const base = `/admin/deck/${deck.id}`;
    links.push(
      { href: base, label: sv.admin.tabOverview, icon: LayoutDashboard, exact: true, also: [`${base}/statistik`] },
      { href: `${base}/innehall`, label: sv.admin.tabContent, icon: Layers, also: [`${base}/kategori`, `${base}/kort`] },
      { href: `${base}/granskning`, label: sv.admin.tabReview, icon: ClipboardCheck, badge: deck.pendingDrafts, badgeLabel: sv.shell.pendingDrafts(deck.pendingDrafts) },
      { href: `${base}/tentor`, label: sv.admin.tabExams, icon: ScrollText },
      { href: `${base}/rapporter`, label: sv.admin.tabReports, icon: Flag, badge: deck.openReports, badgeLabel: sv.shell.openReports(deck.openReports) },
      { href: `${base}/import`, label: sv.admin.tabImport, icon: Upload },
      { href: `${base}/installningar`, label: sv.admin.tabSettings, icon: Settings2 },
    );
  }
  if (isAdmin) links.push({ href: "/admin/deck", label: sv.shell.allCourses, icon: LayoutList, exact: true, also: ["/admin/deck/ny"] });
  if (isAdmin) links.push({ href: "/designsystem", label: sv.shell.designSystem, icon: Palette });
  return links;
}

/**
 * Kursens två poster: Kurssidan (lägen, områden, pass) och Tentaläget, med lås när tentaläget
 * inte är öppet för studenterna och användaren inte är redaktör för kursen.
 */
function courseLinks(course: SidebarProps["courses"][number], adminDeckIds: string[]): NavLink[] {
  const base = `/d/${course.slug}`;
  const locked = !course.examModeOpen && !adminDeckIds.includes(course.id);
  return [
    { href: base, label: sv.shell.coursePage, icon: BookOpen, exact: true, also: [`${base}/plugga`], testId: "nav-course-page" },
    { href: `${base}/tenta`, label: sv.shell.examMode, icon: ClipboardPen, locked, lockedLabel: sv.shell.examModeLocked, testId: "nav-exam-mode" },
  ];
}

/** Innehållet i sidomenyn; samma på desktop och i mobilens utdragbara meny. */
function SidebarContent({ user, adminDeck, adminDeckIds, isAdmin, courses, pathname, top, drawer }: SidebarProps & { pathname: string; top: React.ReactNode; drawer?: boolean }) {
  // Med flera kurser: Kurser, och kursens två poster när man är inne i en kurs.
  const inCourse = courses.find((c) => under(pathname, `/d/${c.slug}`));
  const study: NavLink[] = [
    { href: "/hem", label: sv.shell.home, icon: House },
    { href: "/statistik", label: sv.shell.myStats, icon: ChartNoAxesColumn },
    ...(courses.length === 1 && courses[0]
      ? courseLinks(courses[0], adminDeckIds)
      : [{ href: "/kurser", label: sv.shell.courses, icon: Library, exact: true }, ...(inCourse ? courseLinks(inCourse, adminDeckIds) : [])]),
  ];
  const admin = adminLinks(adminDeck, isAdmin);
  return (
    <>
      {top}
      <nav aria-label={sv.shell.mainNav} className="flex-1 overflow-y-auto px-3 pb-3">
        <SectionLabel>{sv.shell.sectionStudy}</SectionLabel>
        <div className="space-y-0.5">
          {study.map((l) => (
            <NavItem key={l.href} link={l} pathname={pathname} drawer={drawer} />
          ))}
        </div>
        {admin.length > 0 ? (
          <>
            <SectionLabel>{sv.shell.sectionAdmin}</SectionLabel>
            <div className="space-y-0.5" data-testid="sidebar-admin">
              {admin.map((l) => (
                <NavItem key={l.href} link={l} pathname={pathname} drawer={drawer} />
              ))}
            </div>
          </>
        ) : null}
      </nav>
      {/* Avgränsad från listan ovanför: på låga skärmar rullar listan, och utan kant såg den
          avklippta sista posten ut att ligga under Hjälp. */}
      <div className="space-y-0.5 border-t border-line px-3 pb-4 pt-2">
        <NavItem link={{ href: "/hjalp", label: sv.shell.help, icon: CircleHelp }} pathname={pathname} drawer={drawer} />
        <NavItem link={{ href: "/om", label: sv.shell.about, icon: Info }} pathname={pathname} drawer={drawer} />
        <NavItem link={{ href: "/integritet", label: sv.shell.privacy, icon: ShieldCheck }} pathname={pathname} drawer={drawer} />
        <ProfileMenu user={user} placement="right-end" />
      </div>
    </>
  );
}

/**
 * Appens skal för inloggade: fast sidomeny på desktop (går att fälla ihop, valet sparas
 * i kuggfri:sidebar och sätts före första målningen), toppfält med utdragbar meny på mobil.
 */
export function Sidebar(props: SidebarProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  /** Stänger menyn och lämnar fokus på menyknappen, så att det inte tappas till sidans början. */
  function closeDrawer() {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }

  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebar === "collapsed");
  }, []);

  // Menyn stängs när man navigerat.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    // Fokus in i menyn när den öppnas, så att Tab går genom posterna och inte sidan bakom.
    closeButtonRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // Redan hanterat, t.ex. Esc som stänger profilmenyn inne i menyn.
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      } else if (e.key === "Tab") {
        // Tab stannar i menyn: sidan bakom är täckt och fokus där syns inte.
        const items = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []).filter((el) => el.tabIndex >= 0);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    const root = document.documentElement;
    if (next) root.dataset.sidebar = "collapsed";
    else delete root.dataset.sidebar;
    try {
      if (next) localStorage.setItem(SIDEBAR_KEY, "collapsed");
      else localStorage.removeItem(SIDEBAR_KEY);
    } catch {
      // Blockerad lagring: valet gäller tills sidan laddas om.
    }
  }

  const desktopTop = (
    <div className="sidebar-top flex items-center justify-between gap-2 px-4 pb-1 pt-4">
      <Link href="/hem" aria-label={sv.shell.home} className="inline-flex items-center rounded-md">
        <span data-sidebar-label>
          <Logo variant="menu" height={34} priority decorative />
        </span>
        <span data-sidebar-collapsed-only>
          <Image src="/logo-mark-light.png" alt="" width={36} height={36} className="block h-9 w-9 dark:hidden" />
          <Image src="/logo-mark-dark.png" alt="" width={36} height={36} className="hidden h-9 w-9 dark:block" />
        </span>
      </Link>
      <IconButton label={collapsed ? sv.shell.expand : sv.shell.collapse} variant="outline" size="sm" onClick={toggleCollapsed} aria-expanded={!collapsed}>
        <ChevronsLeft size={16} strokeWidth={2} aria-hidden className={cx("transition-transform duration-300", collapsed && "rotate-180")} />
      </IconButton>
    </div>
  );

  const drawerTop = (
    <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-4">
      <Link href="/hem" aria-label={sv.shell.home} className="inline-flex items-center rounded-md">
        <Logo variant="menu" height={34} decorative />
      </Link>
      <IconButton ref={closeButtonRef} label={sv.shell.closeMenu} variant="outline" size="sm" className="relative after:absolute after:-inset-1.5" onClick={closeDrawer}>
        <X size={16} strokeWidth={2} aria-hidden />
      </IconButton>
    </div>
  );

  return (
    <>
      <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-sidebar lg:flex dark:border-transparent">
        <SidebarContent {...props} pathname={pathname} top={desktopTop} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-bg/85 px-2 backdrop-blur lg:hidden">
        <IconButton ref={menuButtonRef} label={sv.shell.openMenu} className="relative after:absolute after:-inset-0.5" onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen}>
          <MenuIcon size={20} strokeWidth={2} aria-hidden />
        </IconButton>
        <Link href="/hem" aria-label={sv.shell.home} className="inline-flex items-center rounded-md">
          <Logo variant="menu" height={30} decorative />
        </Link>
        <ProfileMenu user={props.user} placement="bottom-end" compact />
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label={sv.shell.closeMenu} tabIndex={-1} onClick={closeDrawer} className="anim-fade-in absolute inset-0 bg-overlay" />
          <aside ref={drawerRef} aria-label={sv.shell.mainNav} className="anim-drawer absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-sidebar shadow-pop">
            <SidebarContent {...props} pathname={pathname} top={drawerTop} drawer />
          </aside>
        </div>
      ) : null}
    </>
  );
}
