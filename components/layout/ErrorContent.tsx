"use client";

import { useEffect } from "react";
import { sv } from "@/lib/i18n/sv";
import { Button, LinkButton } from "@/components/ui/Button";
import { StatusMessage } from "@/components/layout/StatusMessage";

/** Felsida i sajtens stil i stället för Next.js råa "Application error". */
export function ErrorContent({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusMessage
      title={sv.errors.pageTitle}
      body={sv.errors.pageBody}
      actions={
        <>
          <Button onClick={reset}>{sv.errors.retry}</Button>
          <LinkButton href="/" variant="secondary">
            {sv.common.toHome}
          </LinkButton>
        </>
      }
    />
  );
}
