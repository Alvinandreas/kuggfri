import { sv } from "@/lib/i18n/sv";
import { LinkButton } from "@/components/ui/Button";
import { FullPage, StatusMessage } from "@/components/layout/StatusMessage";

/** Renderas med status 403 när en sida anropar forbidden(). */
export default function Forbidden() {
  return (
    <FullPage>
      <StatusMessage
        title={sv.common.forbiddenTitle}
        body={sv.common.forbiddenBody}
        actions={
          <LinkButton href="/" variant="secondary">
            {sv.common.toHome}
          </LinkButton>
        }
      />
    </FullPage>
  );
}
