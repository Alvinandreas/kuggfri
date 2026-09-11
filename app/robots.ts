import type { MetadataRoute } from "next";

/** Sajten ska inte indexeras. Medvetet val, se README. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
