import type { UserRole } from "@/types/roles";

export interface NavItem {
  to: string;
  label: string;
  /** Si se omite, el ítem es visible para cualquier rol autenticado (ver
   * TDD §5.1: todos los roles ven la misma información del dashboard). */
  allowedRoles?: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/admin", label: "Administración", allowedRoles: ["admin"] },
];

export function visibleNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.allowedRoles || item.allowedRoles.includes(role));
}
