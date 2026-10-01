import { getT } from "@/lib/i18n/server";
import { LinkButton } from "@/components/ui/Button";
import { FullPage, StatusMessage } from "@/components/layout/StatusMessage";
import { routes } from "@/lib/routes";

/** Renderas med status 403 när en sida anropar forbidden(). */
export default async function Forbidden() {
  const sv = await getT();
  return (
    <FullPage>
      <StatusMessage
        title={sv.common.forbiddenTitle}
        body={sv.common.forbiddenBody}
        actions={
          <LinkButton href={routes.landing()} variant="secondary">
            {sv.common.toHome}
          </LinkButton>
        }
      />
    </FullPage>
  );
}
