import { getT } from "@/lib/i18n/server";
import { LinkButton } from "@/components/ui/Button";
import { FullPage, StatusMessage } from "@/components/layout/StatusMessage";
import { routes } from "@/lib/routes";

/** Okända adresser: ingen layout omger sidan, så den bär sin egen helsidesram. */
export default async function NotFound() {
  const sv = await getT();
  return (
    <FullPage>
      <StatusMessage
        title={sv.common.notFound}
        actions={
          <LinkButton href={routes.landing()} variant="secondary">
            {sv.common.toHome}
          </LinkButton>
        }
      />
    </FullPage>
  );
}
