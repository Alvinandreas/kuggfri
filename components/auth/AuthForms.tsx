"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { MailCheck } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import {
  resendConfirmationAction,
  sendMagicLinkAction,
  sendPasswordResetAction,
  signInWithPasswordAction,
  signUpAction,
  type AuthResult,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { GoogleButton } from "./GoogleButton";
import { routes } from "@/lib/routes";

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
  return <ErrorBanner>{result.error}</ErrorBanner>;
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

/** Knapp som skickar bekräftelsemejlet igen till en adress som väntar på bekräftelse. */
function ResendConfirmation({ email, next }: { email: string; next: string }) {
  const [state, action, pending] = useActionState((prev: AuthResult | null, fd: FormData) => run(resendConfirmationAction, prev, fd), null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <Message result={state} />
      <Button type="submit" variant="outline" disabled={pending} data-testid="resend-confirmation">
        {sv.auth.resend}
      </Button>
    </form>
  );
}

/**
 * "Kolla din inkorg": visas i stället för registreringsformuläret när kontot är skapat men
 * adressen ska bekräftas. Adressen står med, så att ett stavfel syns direkt.
 */
function CheckInbox({ email, next, level, onRestart }: { email: string; next: string; level: 1 | 2; onRestart: () => void }) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <div className="grid gap-5" data-testid="check-inbox">
      <div className="flex items-center gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <MailCheck size={24} strokeWidth={2} aria-hidden />
        </span>
        <H className="text-2xl font-bold tracking-tight">{sv.auth.checkInboxTitle}</H>
      </div>
      <p>
        {sv.auth.checkInboxLead} <strong className="break-all">{email}</strong>. {sv.auth.checkInboxBody}
      </p>
      <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-muted">{sv.auth.checkInboxSpam}</p>
      <ResendConfirmation email={email} next={next} />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <p className="text-muted">
          {sv.auth.checkInboxConfirmed}{" "}
          <Link href={routes.login({ next })} className={linkClass}>
            {sv.auth.login}
          </Link>
        </p>
        <button type="button" onClick={onRestart} className={linkClass}>
          {sv.auth.checkInboxWrongEmail}
        </button>
      </div>
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

export function LoginFields({
  next,
  initialError = null,
  initialNotice = null,
  heading,
}: {
  next: string;
  initialError?: string | null;
  initialNotice?: string | null;
  heading?: ReactNode;
}) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    (prev: AuthResult | null, fd: FormData) => run(signInWithPasswordAction, prev, fd),
    null,
  );
  const [linkState, linkAction, linkPending] = useActionState((prev: AuthResult | null, fd: FormData) => run(sendMagicLinkAction, prev, fd), null);
  const [useLink, setUseLink] = useState(false);
  const unconfirmedEmail = !useLink && passwordState && !passwordState.ok ? passwordState.unconfirmedEmail : undefined;

  return (
    <div className="grid gap-5">
      {heading ?? <FormHeading title={useLink ? sv.auth.magicLinkTitle : sv.auth.loginTitle} />}
      {initialError ? <ErrorBanner>{initialError}</ErrorBanner> : null}
      {initialNotice && !unconfirmedEmail ? (
        <p role="status" className="rounded-md bg-surface-2 px-4 py-3 text-sm" data-testid="login-notice">
          {initialNotice}
        </p>
      ) : null}
      {unconfirmedEmail ? (
        <div className="grid gap-3 rounded-lg border border-line p-4" data-testid="login-unconfirmed">
          <p role="alert" className="text-sm font-medium">
            {sv.auth.notConfirmed}
          </p>
          <ResendConfirmation key={unconfirmedEmail} email={unconfirmedEmail} next={next} />
        </div>
      ) : null}

      {useLink ? null : <GoogleButton next={next} />}

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
              <Link href={routes.forgotPassword()} className={`text-sm ${linkClass}`}>
                {sv.auth.forgotLink}
              </Link>
            }
          />
          {unconfirmedEmail ? null : <Message result={passwordState} />}
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

export function RegisterFields({ next, heading, level = 1 }: { next: string; heading?: ReactNode; level?: 1 | 2 }) {
  const [state, action, pending] = useActionState((prev: AuthResult | null, fd: FormData) => run(signUpAction, prev, fd), null);
  // "Börja om" från Kolla din inkorg visar formuläret igen utan att glömma svaret från servern.
  const [restarted, setRestarted] = useState(false);
  const pendingEmail = state?.ok && state.checkEmail && !restarted ? state.checkEmail : null;

  if (pendingEmail) return <CheckInbox email={pendingEmail} next={next} level={level} onRestart={() => setRestarted(true)} />;

  return (
    <div className="grid gap-5">
      {heading ?? <FormHeading title={sv.auth.registerTitle} />}
      <GoogleButton next={next} />
      <form action={action} onSubmit={() => setRestarted(false)} className="grid gap-4">
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
        {state?.ok && restarted ? null : <Message result={state} />}
        <Button type="submit" size="lg" disabled={pending} data-testid="register-submit">
          {sv.auth.register}
        </Button>
        <p className="text-xs text-muted">{sv.auth.privacyNote}</p>
      </form>
    </div>
  );
}

export function LoginForm({ next, initialError = null, initialNotice = null }: { next: string; initialError?: string | null; initialNotice?: string | null }) {
  return (
    <AuthCard>
      <LoginFields next={next} initialError={initialError} initialNotice={initialNotice} />
      <p className="mt-6 text-sm text-muted">
        {sv.auth.noAccount}{" "}
        <Link href={routes.register({ next })} className={linkClass}>
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
        <Link href={routes.login({ next })} className={linkClass}>
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
        <Link href={routes.login()} className={`w-fit text-sm ${linkClass}`}>
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
        <RegisterFields key="registrera" next={next} level={2} heading={<FormHeading level={2} title={sv.landing.registerTitle} lead={sv.landing.registerLead} />} />
      ) : (
        <LoginFields key="logga-in" next={next} heading={<FormHeading level={2} title={sv.landing.loginTitle} lead={sv.landing.loginLead} />} />
      )}
    </AuthCard>
  );
}
