export const mainNavigationTabs = [
  { label: "HOME", href: "/pages/Home" },
  { label: "WILDFIRE", href: "/pages/Wildfire" },
  { label: "RUINS", href: "/pages/The-ruins" },
  { label: "PROJECTS", href: "/pages/Projects" },
  { label: "BIO", href: "/pages/who-is-g" },
] as const;

export function normalizeMainNavigationPath(pathname: string) {
  if (pathname === "/") return "/pages/Home";
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
}
