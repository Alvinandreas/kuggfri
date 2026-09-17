"use client";

import { useEffect } from "react";
import { sv } from "@/lib/i18n/sv";
import { Button, LinkButton } from "@/components/ui/Button";

/** Felsida i sajtens stil i stället för Next.js råa "Application error". */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">{sv.errors.pageTitle}</h1>
      <p className="mt-2 text-muted">{sv.errors.pageBody}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>{sv.errors.retry}</Button>
        <LinkButton href="/" variant="secondary">
          {sv.common.toHome}
        </LinkButton>
      </div>
    </div>
  );
}
