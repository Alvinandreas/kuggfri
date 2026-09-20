"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { sendMagicLinkAction, sendPasswordResetAction, signInWithPasswordAction, signUpAction, type AuthResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";

const inputClass = "h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-fg";

function Message({ result }: { result: AuthResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return result.message ? (
      <p role="status" className="rounded-md bg-accent-soft px-3 py-2 text-sm">
        {result.message}
      </p>
    ) : null;
  }
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {result.error}
    </p>
  );
}

async function run(action: (fd: FormData) => Promise<AuthResult>, _prev: AuthResult | null, fd: FormData): Promise<AuthResult | null> {
  return action(fd);
}

export function LoginForm({ next, initialError = null }: { next: string; initialError?: string | null }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    (prev: AuthResult | null, fd: FormData) => run(signInWithPasswordAction, prev, fd),
    null,
  );
  const [linkState, linkAction, linkPending] = useActionState(
    (prev: AuthResult | null, fd: FormData) => run(sendMagicLinkAction, prev, fd),
    null,
  );
  const [useLink, setUseLink] = useState(false);

  return (
    <div className="mx-auto grid max-w-md gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{useLink ? sv.auth.magicLinkTitle : sv.auth.loginTitle}</h1>
      {initialError ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {initialError}
        </p>
      ) : null}

      {useLink ? (
        <form action={linkAction} className="grid gap-4">
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-muted">{sv.auth.magicLinkHelp}</p>
          <label className="grid gap-1 text-sm">
            <span>{sv.auth.email}</span>
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </label>
          <Message result={linkState} />
          <Button type="submit" disabled={linkPending}>
            {sv.auth.magicLinkTitle}
          </Button>
          <button type="button" onClick={() => setUseLink(false)} className="-my-1 w-fit py-1 text-sm text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent">
            {sv.auth.orPassword}
          </button>
        </form>
      ) : (
        <form action={passwordAction} className="grid gap-4">
          <input type="hidden" name="next" value={next} />
          <label className="grid gap-1 text-sm">
            <span>{sv.auth.email}</span>
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>{sv.auth.password}</span>
            <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
          </label>
          <Message result={passwordState} />
          <Button type="submit" disabled={passwordPending} data-testid="login-submit">
            {sv.auth.login}
          </Button>
          <button type="button" onClick={() => setUseLink(true)} className="-my-1 w-fit py-1 text-sm text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent">
            {sv.auth.magicLink}
          </button>
          <Link href="/glomt-losenord" className="-my-1 w-fit py-1 text-sm text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent">
            {sv.auth.forgotLink}
          </Link>
        </form>
      )}

      <p className="text-sm text-muted">
        {sv.auth.noAccount}{" "}
        <Link href={`/registrera?next=${encodeURIComponent(next)}`} className="text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent">
          {sv.auth.register}
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState((prev: AuthResult | null, fd: FormData) => run(signUpAction, prev, fd), null);

  return (
    <div className="mx-auto grid max-w-md gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{sv.auth.registerTitle}</h1>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1 text-sm">
          <span>{sv.auth.email}</span>
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span>{sv.auth.password}</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          <span className="text-xs text-muted">{sv.auth.passwordHelp}</span>
        </label>
        <label className="grid gap-1 text-sm">
          <span>{sv.auth.displayName}</span>
          <input name="display_name" type="text" maxLength={80} autoComplete="nickname" className={inputClass} />
        </label>
        <Message result={state} />
        <Button type="submit" disabled={pending} data-testid="register-submit">
          {sv.auth.register}
        </Button>
        <p className="text-xs text-muted">{sv.auth.privacyNote}</p>
      </form>
      <p className="text-sm text-muted">
        {sv.auth.hasAccount}{" "}
        <Link href={`/logga-in?next=${encodeURIComponent(next)}`} className="text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent">
          {sv.auth.login}
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState((prev: AuthResult | null, fd: FormData) => run(sendPasswordResetAction, prev, fd), null);

  return (
    <div className="mx-auto grid max-w-md gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{sv.auth.forgotTitle}</h1>
      <form action={action} className="grid gap-4">
        <p className="text-sm text-muted">{sv.auth.forgotHelp}</p>
        <label className="grid gap-1 text-sm">
          <span>{sv.auth.email}</span>
          <input name="email" type="email" required autoComplete="email" className={inputClass} data-testid="forgot-email" />
        </label>
        <Message result={state} />
        <Button type="submit" disabled={pending || state?.ok === true} data-testid="forgot-submit">
          {sv.auth.forgotSend}
        </Button>
      </form>
      <p className="text-sm text-muted">
        <Link href="/logga-in" className="text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent">
          {sv.auth.backToLogin}
        </Link>
      </p>
    </div>
  );
}
