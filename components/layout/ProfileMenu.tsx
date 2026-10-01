"use client";

import { useTransition } from "react";
import { Info, LogOut, ShieldCheck, SunMoon, UserRound } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { signOutAction } from "@/lib/auth/actions";
import { Avatar } from "@/components/ui/Avatar";
import { Menu, MenuHeader, MenuItem, MenuRow, MenuSeparator, type MenuPlacement } from "@/components/ui/Menu";
import { ThemeSwitcher } from "@/components/ui/ThemeToggle";
import { routes } from "@/lib/routes";

export type ShellUser = { name: string; email: string };

/**
 * Profilknappen och dess meny: vem som är inloggad, konto, tema, integritet och
 * utloggning. "compact" visar bara avataren (mobilens toppfält).
 */
export function ProfileMenu({ user, placement, compact = false }: { user: ShellUser; placement: MenuPlacement; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Menu
      label={sv.shell.profileMenu}
      placement={placement}
      width="17rem"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`${sv.shell.profileMenu}: ${user.name}`}
          data-testid="profile-menu"
          className={
            compact
              ? "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-surface-2"
              : "nav-item flex h-11 w-full items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-surface-2 aria-expanded:bg-surface-2"
          }
        >
          <Avatar name={user.name} size={30} />
          {compact ? null : (
            <span data-sidebar-label className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">
              {user.name}
            </span>
          )}
        </button>
      )}
    >
      <MenuHeader>
        <div className="flex items-center gap-3">
          <Avatar name={user.name} size={36} />
          <div className="min-w-0">
            <p className="truncate font-bold">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
        </div>
      </MenuHeader>
      <MenuItem href={routes.account()} icon={<UserRound size={18} />}>
        {sv.shell.account}
      </MenuItem>
      <MenuRow label={sv.shell.theme} icon={<SunMoon size={18} />}>
        <ThemeSwitcher inMenu />
      </MenuRow>
      <MenuItem href={routes.privacy()} icon={<ShieldCheck size={18} />}>
        {sv.shell.privacy}
      </MenuItem>
      <MenuItem href={routes.about()} icon={<Info size={18} />}>
        {sv.shell.about}
      </MenuItem>
      <MenuSeparator />
      <MenuItem tone="danger" icon={<LogOut size={18} />} disabled={pending} onSelect={() => startTransition(() => signOutAction())}>
        {sv.shell.logout}
      </MenuItem>
    </Menu>
  );
}
