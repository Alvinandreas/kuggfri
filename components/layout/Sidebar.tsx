"use client";

import { useEffect, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronsLeft, CircleHelp, House, Library, Menu as MenuIcon, Palette, Settings2, X, type LucideProps } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Logo } from "@/components/layout/Logo";
import { ProfileMenu, type ShellUser } from "@/components/layout/ProfileMenu";

type NavLink = { href: string; label: string; icon: ComponentType<LucideProps>; /** Fler sökvägsprefix där posten räknas som aktiv. */ also?: string[] };

export type SidebarProps = {
  user: ShellUser;
  /** Admin eller examinator: ser adminlänken. */
  canAdmin: boolean;
  /** Global admin: ser också designsystemet. */
  isAdmin: boolean;
  /** Publicerade kurser. Med en enda kurs pekar menyn direkt på den i stället för på Kurser. */
  courses: { slug: string; title: string }[];
};

const SIDEBAR_KEY = "kuggfri:sidebar";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const active = isActive(pathname, link.href) || (link.also ?? []).some((p) => pathname.startsWith(p));
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-label={link.label}
      title={link.label}
      aria-current={active ? "page" : undefined}
      className={cx(
        "nav-item flex h-10 items-center gap-3 rounded-md px-3 text-[0.95rem] font-medium transition-colors duration-150",
        active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon size={19} strokeWidth={active ? 2.2 : 1.9} aria-hidden className="shrink-0" />
      <span data-sidebar-label className="truncate">
        {link.label}
      </span>
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

/** Innehållet i sidomenyn; samma på desktop och i mobilens utdragbara meny. */
function SidebarContent({ user, canAdmin, isAdmin, courses, pathname, top }: SidebarProps & { pathname: string; top: React.ReactNode }) {
  const study: NavLink[] = [
    { href: "/hem", label: sv.shell.home, icon: House },
    courses.length === 1 && courses[0]
      ? { href: `/d/${courses[0].slug}`, label: courses[0].title, icon: BookOpen, also: ["/d/"] }
      : { href: "/kurser", label: sv.shell.courses, icon: Library, also: ["/d/"] },
  ];
  const admin: NavLink[] = [
    ...(canAdmin ? [{ href: "/admin", label: sv.shell.admin, icon: Settings2 }] : []),
    ...(isAdmin ? [{ href: "/designsystem", label: sv.shell.designSystem, icon: Palette }] : []),
  ];
  return (
    <>
      {top}
      <nav aria-label={sv.shell.mainNav} className="flex-1 overflow-y-auto px-3 pb-3">
        <SectionLabel>{sv.shell.sectionStudy}</SectionLabel>
        <div className="space-y-0.5">
          {study.map((l) => (
            <NavItem key={l.href} link={l} pathname={pathname} />
          ))}
        </div>
        {admin.length > 0 ? (
          <>
            <SectionLabel>{sv.shell.sectionAdmin}</SectionLabel>
            <div className="space-y-0.5">
              {admin.map((l) => (
                <NavItem key={l.href} link={l} pathname={pathname} />
              ))}
            </div>
          </>
        ) : null}
      </nav>
      <div className="space-y-0.5 px-3 pb-4">
        <NavItem link={{ href: "/om", label: sv.shell.help, icon: CircleHelp }} pathname={pathname} />
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

  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebar === "collapsed");
  }, []);

  // Menyn stängs när man navigerat.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
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
      <IconButton label={sv.shell.closeMenu} variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>
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
        <IconButton label={sv.shell.openMenu} onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen}>
          <MenuIcon size={20} strokeWidth={2} aria-hidden />
        </IconButton>
        <Link href="/hem" aria-label={sv.shell.home} className="inline-flex items-center rounded-md">
          <Logo variant="menu" height={30} decorative />
        </Link>
        <ProfileMenu user={props.user} placement="bottom-end" compact />
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label={sv.shell.closeMenu} tabIndex={-1} onClick={() => setDrawerOpen(false)} className="anim-fade-in absolute inset-0 bg-overlay" />
          <aside aria-label={sv.shell.mainNav} className="anim-drawer absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-sidebar shadow-pop">
            <SidebarContent {...props} pathname={pathname} top={drawerTop} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
