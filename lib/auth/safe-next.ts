/** Tillåter bara interna sökvägar som mål efter inloggning. */
export function safeNext(next: unknown, fallback = "/"): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
