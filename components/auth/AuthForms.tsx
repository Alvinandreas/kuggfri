"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { sv } from "@/lib/i18n/sv";
import { sendMagicLinkAction, sendPasswordResetAction, signInWithPasswordAction, signUpAction, type AuthResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";

const linkClass = "font-semibold text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent";

function Message({ result }: { result: AuthResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return result.message ? (
      <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
        {result.message}
      </p>
    ) : null;
  }
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
      {result.error}
    </p>
  );
}

async function run(action: (fd: FormData) => Promise<AuthResult>, _prev: AuthResult | null, fd: FormData): Promise<AuthResult | null> {
  return action(fd);
}

/** Rubrik och ingress ovanför ett formulär. */
function FormHeading({ title, lead, level = 1 }: { title: string; lead?: string; level?: 1 | 2 }) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <div>
      <H className="text-2xl font-bold tracking-tight">{title}</H>
      {lead ? <p className="mt-1 text-muted">{lead}</p> : null}
    </div>
  );
}

/** Kortet som auth-sidorna står i: centrerat, luftigt, samma form som resten av appen. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <Card padding="lg" className="anim-fade-up mx-auto w-full max-w-md shadow-card sm:p-8">
      {children}
    </Card>
  );
}

export function LoginFields({ next, initialError = null, heading }: { next: string; initialError?: string | null; heading?: ReactNode }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    (prev: AuthResult | null, fd: FormData) => run(signInWithPasswordAction, prev, fd),
    null,
  );
  const [linkState, linkAction, linkPending] = useActionState((prev: AuthResult | null, fd: FormData) => run(sendMagicLinkAction, prev, fd), null);
  const [useLink, setUseLink] = useState(false);

  return (
    <div className="grid gap-5">
      {heading ?? <FormHeading title={useLink ? sv.auth.magicLinkTitle : sv.auth.loginTitle} />}
      {initialError ? (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {initialError}
        </p>
      ) : null}

      {useLink ? (
        <form action={linkAction} className="grid gap-4">
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-muted">{sv.auth.magicLinkHelp}</p>
          <TextField label={sv.auth.email} name="email" type="email" required autoComplete="email" />
          <Message result={linkState} />
          <Button type="submit" size="lg" disabled={linkPending}>
            {sv.auth.magicLinkTitle}
          </Button>
          <button type="button" onClick={() => setUseLink(false)} className={`w-fit text-sm ${linkClass}`}>
            {sv.auth.orPassword}
          </button>
        </form>
      ) : (
        <form action={passwordAction} className="grid gap-4">
          <input type="hidden" name="next" value={next} />
          <TextField label={sv.auth.email} name="email" type="email" required autoComplete="email" />
          <TextField
            label={sv.auth.password}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            labelAction={
              <Link href="/glomt-losenord" className={`text-sm ${linkClass}`}>
                {sv.auth.forgotLink}
              </Link>
            }
          />
          <Message result={passwordState} />
          <Button type="submit" size="lg" disabled={passwordPending} data-testid="login-submit">
            {sv.auth.login}
          </Button>
          <button type="button" onClick={() => setUseLink(true)} className={`w-fit text-sm ${linkClass}`}>
            {sv.auth.magicLink}
          </button>
        </form>
      )}
    </div>
  );
}

export function RegisterFields({ next, heading }: { next: string; heading?: ReactNode }) {
  const [state, action, pending] = useActionState((prev: AuthResult | null, fd: FormData) => run(signUpAction, prev, fd), null);

  return (
    <div className="grid gap-5">
      {heading ?? <FormHeading title={sv.auth.registerTitle} />}
      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <TextField
          label={sv.auth.displayName}
          name="display_name"
          type="text"
          required
          maxLength={80}
          autoComplete="name"
          placeholder={sv.auth.displayNamePlaceholder}
        />
        <TextField label={sv.auth.email} name="email" type="email" required autoComplete="email" />
        <TextField label={sv.auth.password} name="password" type="password" required minLength={8} autoComplete="new-password" hint={sv.auth.passwordHelp} />
        <Message result={state} />
        <Button type="submit" size="lg" disabled={pending} data-testid="register-submit">
          {sv.auth.register}
        </Button>
        <p className="text-xs text-muted">{sv.auth.privacyNote}</p>
      </form>
    </div>
  );
}

export function LoginForm({ next, initialError = null }: { next: string; initialError?: string | null }) {
  return (
    <AuthCard>
      <LoginFields next={next} initialError={initialError} />
      <p className="mt-6 text-sm text-muted">
        {sv.auth.noAccount}{" "}
        <Link href={`/registrera?next=${encodeURIComponent(next)}`} className={linkClass}>
          {sv.auth.register}
        </Link>
      </p>
    </AuthCard>
  );
}

export function RegisterForm({ next }: { next: string }) {
  return (
    <AuthCard>
      <RegisterFields next={next} />
      <p className="mt-6 text-sm text-muted">
        {sv.auth.hasAccount}{" "}
        <Link href={`/logga-in?next=${encodeURIComponent(next)}`} className={linkClass}>
          {sv.auth.login}
        </Link>
      </p>
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState((prev: AuthResult | null, fd: FormData) => run(sendPasswordResetAction, prev, fd), null);

  return (
    <AuthCard>
      <div className="grid gap-5">
        <FormHeading title={sv.auth.forgotTitle} lead={sv.auth.forgotHelp} />
        <form action={action} className="grid gap-4">
          <TextField label={sv.auth.email} name="email" type="email" required autoComplete="email" data-testid="forgot-email" />
          <Message result={state} />
          <Button type="submit" size="lg" disabled={pending || state?.ok === true} data-testid="forgot-submit">
            {sv.auth.forgotSend}
          </Button>
        </form>
        <Link href="/logga-in" className={`w-fit text-sm ${linkClass}`}>
          {sv.auth.backToLogin}
        </Link>
      </div>
    </AuthCard>
  );
}

type Tab = "registrera" | "logga-in";

/**
 * Landningssidans formulär: en flik för nya konton och en för inloggning, i samma kort.
 * Fliken styrs lokalt (inget sidbyte), men följer ?flik= så att länkar kan välja den.
 */
export function AuthPanel({ next, initialTab, hint }: { next: string; initialTab: Tab; hint?: string | null }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <AuthCard>
      <div className="mb-6 flex justify-center">
        <SegmentedControl
          label={sv.landing.formLabel}
          value={tab}
          onChange={setTab}
          segments={[
            { value: "registrera", label: sv.landing.tabRegister },
            { value: "logga-in", label: sv.landing.tabLogin },
          ]}
        />
      </div>
      {hint ? <p className="mb-5 rounded-md bg-surface-2 px-4 py-3 text-sm text-muted">{hint}</p> : null}
      {tab === "registrera" ? (
        <RegisterFields key="registrera" next={next} heading={<FormHeading level={2} title={sv.landing.registerTitle} lead={sv.landing.registerLead} />} />
      ) : (
        <LoginFields key="logga-in" next={next} heading={<FormHeading level={2} title={sv.landing.loginTitle} lead={sv.landing.loginLead} />} />
      )}
    </AuthCard>
  );
}
