import { sv } from "@/lib/i18n/sv";
import { LinkButton } from "@/components/ui/Button";
import { StatusMessage } from "@/components/layout/StatusMessage";

/** notFound() inifrån en sida i appskalet: sidomenyn står kvar. */
export default function AppNotFound() {
  return (
    <StatusMessage
      title={sv.common.notFound}
      actions={
        <LinkButton href="/hem" variant="secondary">
          {sv.common.toHome}
        </LinkButton>
      }
    />
  );
}
