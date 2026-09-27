"use client";

import { ErrorContent } from "@/components/layout/ErrorContent";
import { FullPage } from "@/components/layout/StatusMessage";

/** Fel utanför appskalet: ingen layout omger sidan, så den bär sin egen helsidesram. */
export default function ErrorPage(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <FullPage>
      <ErrorContent {...props} />
    </FullPage>
  );
}
