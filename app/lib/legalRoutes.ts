export const legalNavItems = [
  { label: "Privacy Policy", href: "/pages/privacy-policy" },
  { label: "Terms of Service", href: "/pages/terms-of-service" },
  { label: "Disclaimer", href: "/pages/disclaimer" },
  { label: "Communications", href: "/pages/communications" },
  { label: "Accessibility", href: "/pages/accessibility" },
  { label: "Ai Disclosure", href: "/pages/ai-disclosure" },
] as const;

const legalRoutes = new Set([
  "/pages/Wildworks",
  ...legalNavItems.map((item) => item.href),
]);

export function isLegalRoute(pathname: string | null): boolean {
  return pathname != null && legalRoutes.has(pathname);
}
