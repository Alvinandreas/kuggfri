"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import { Button, LinkButton } from "@/components/ui/Button";
import { StatusMessage } from "@/components/layout/StatusMessage";
import { routes } from "@/lib/routes";

/** Felsida i sajtens stil i stället för Next.js råa "Application error". */
export function ErrorContent({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const sv = useT();
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
          <LinkButton href={routes.landing()} variant="secondary">
            {sv.common.toHome}
          </LinkButton>
        </>
      }
    />
  );
}
