import { sv } from "@/lib/i18n/sv";
import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">{sv.common.notFound}</h1>
      <div className="mt-6">
        <LinkButton href="/" variant="secondary">
          {sv.common.toHome}
        </LinkButton>
      </div>
    </div>
  );
}
