"use client";

import { ErrorContent } from "@/components/layout/ErrorContent";

/** Fel inifrån en sida i appskalet: sidomenyn står kvar. */
export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorContent {...props} />;
}
