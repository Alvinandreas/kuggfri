import { sv } from "@/lib/i18n/sv";
import { LinkButton } from "@/components/ui/Button";
import { FullPage, StatusMessage } from "@/components/layout/StatusMessage";
import { routes } from "@/lib/routes";

/** Okända adresser: ingen layout omger sidan, så den bär sin egen helsidesram. */
export default function NotFound() {
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
