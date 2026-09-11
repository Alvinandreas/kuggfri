import { sv } from "@/lib/i18n/sv";
import { LinkButton } from "@/components/ui/Button";

/** Renderas med status 403 när en sida anropar forbidden(). */
export default function Forbidden() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">{sv.common.forbiddenTitle}</h1>
      <p className="mt-2 text-muted">{sv.common.forbiddenBody}</p>
      <div className="mt-6">
        <LinkButton href="/" variant="secondary">
          {sv.common.toHome}
        </LinkButton>
      </div>
    </div>
  );
}
