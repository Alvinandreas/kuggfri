import { sv } from "@/lib/i18n/sv";
import { LinkButton } from "@/components/ui/Button";
import { FullPage, StatusMessage } from "@/components/layout/StatusMessage";

/** Okända adresser: ingen layout omger sidan, så den bär sin egen helsidesram. */
export default function NotFound() {
  return (
    <FullPage>
      <StatusMessage
        title={sv.common.notFound}
        actions={
          <LinkButton href="/" variant="secondary">
            {sv.common.toHome}
          </LinkButton>
        }
      />
    </FullPage>
  );
}
