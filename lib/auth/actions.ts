"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/supabase/request-origin";
import type { Dict } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { safeNext } from "./safe-next";
import { SIGNUP_NEXT_KEY } from "./signup-next";
import { routes } from "@/lib/routes";

/**
 * checkEmail: kontot är skapat men väntar på bekräftelse; adressen visas i "Kolla din inkorg".
 * unconfirmedEmail: inloggningen stoppades för att adressen inte är bekräftad; formuläret
 * erbjuder då att skicka bekräftelsen igen.
 */
export type AuthResult = { ok: true; message?: string; checkEmail?: string } | { ok: false; error: string; unconfirmedEmail?: string };

/** Översätter Supabase Auth-fel till begripliga meddelanden och loggar orsaken (syns i Vercel-loggen). */
function authErrorMessage(sv: Dict, error: { message: string; code?: string }, fallback: string): string {
  const code = (error.code ?? "").toLowerCase();
  const msg = error.message.toLowerCase();
  console.error("[auth]", error.code ?? "", error.message);
  if (code.includes("rate_limit") || msg.includes("rate limit")) return sv.auth.rateLimited;
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already") || msg.includes("registered")) return sv.auth.emailInUse;
  if (code === "signup_disabled" || msg.includes("signups not allowed")) return sv.auth.signupDisabled;
  if (code === "validation_failed" || code === "email_address_invalid" || msg.includes("invalid email") || msg.includes("unable to validate email")) {
    return sv.auth.invalidEmail;
  }
  if (msg.includes("different from the old")) return sv.auth.passwordSame;
  if (code === "weak_password" || msg.includes("password")) return sv.auth.weakPassword;
  return fallback;
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(routes.landing());
}

export async function signInWithPasswordAction(formData: FormData): Promise<AuthResult> {
  const sv = await getT();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"), routes.home());
  if (!email || !password) return { ok: false, error: sv.auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const code = (error.code ?? "").toLowerCase();
    if (code === "email_not_confirmed") return { ok: false, error: sv.auth.notConfirmed, unconfirmedEmail: email };
    return { ok: false, error: authErrorMessage(sv, error, sv.auth.invalidCredentials) };
  }
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  const sv = await getT();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 80);
  const next = safeNext(formData.get("next"), routes.home());
  if (!displayName) return { ok: false, error: sv.auth.nameRequired };
  if (!email) return { ok: false, error: sv.auth.error };
  if (password.length < 8) return { ok: false, error: sv.auth.weakPassword };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, [SIGNUP_NEXT_KEY]: next },
      emailRedirectTo: `${await getRequestOrigin()}${routes.authConfirm({ next })}`,
    },
  });
  if (error) return { ok: false, error: authErrorMessage(sv, error, sv.auth.error) };
  // Med e-postbekräftelse avstängd finns en session direkt.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }
  // Supabase returnerar en "fejkad" användare utan identities när e-posten redan finns.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { ok: false, error: sv.auth.emailInUse };
  }
  return { ok: true, message: sv.auth.checkEmail, checkEmail: email };
}

/**
 * Skickar bekräftelsemejlet igen (från "Kolla din inkorg" och från inloggningen när adressen
 * inte är bekräftad). Svaret är detsamma oavsett om adressen har ett konto.
 */
export async function resendConfirmationAction(formData: FormData): Promise<AuthResult> {
  const sv = await getT();
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNext(formData.get("next"), routes.home());
  if (!email) return { ok: false, error: sv.auth.invalidEmail };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await getRequestOrigin()}${routes.authConfirm({ next })}` },
  });
  if (error) {
    const code = (error.code ?? "").toLowerCase();
    if (code === "over_email_send_rate_limit" || error.status === 429) {
      console.error("[auth]", error.code ?? "", error.message);
      return { ok: false, error: sv.auth.resendWait };
    }
    const message = authErrorMessage(sv, error, sv.auth.error);
    if (message === sv.auth.rateLimited || message === sv.auth.invalidEmail) return { ok: false, error: message };
  }
  return { ok: true, message: sv.auth.resendSent };
}

export async function sendMagicLinkAction(formData: FormData): Promise<AuthResult> {
  const sv = await getT();
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNext(formData.get("next"), routes.home());
  if (!email) return { ok: false, error: sv.auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await getRequestOrigin()}${routes.authConfirm({ next })}`,
      // Konton skapas bara via registreringen (namn + bekräftat välkomstmejl), aldrig via en inloggningslänk.
      shouldCreateUser: false,
    },
  });
  // Okänd adress: samma svar som när länken skickats, så att formuläret inte avslöjar vilka adresser som har konto.
  if (error && (error.code === "otp_disabled" || /signups not allowed/i.test(error.message))) {
    return { ok: true, message: sv.auth.magicLinkSent };
  }
  if (error) return { ok: false, error: authErrorMessage(sv, error, sv.auth.error) };
  return { ok: true, message: sv.auth.magicLinkSent };
}

/**
 * Glömt lösenord: mejlar en återställningslänk (mallen "Reset Password" med token_hash).
 * Länken loggar in via /auth/confirm och leder till lösenordsbytet under Konto.
 * Svaret är detsamma oavsett om adressen finns, så att konton inte kan listas.
 */
export async function sendPasswordResetAction(formData: FormData): Promise<AuthResult> {
  const sv = await getT();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, error: sv.auth.invalidEmail };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getRequestOrigin()}${routes.authConfirm({ next: routes.account({ bytLosenord: true }) })}`,
  });
  if (error) {
    const message = authErrorMessage(sv, error, sv.auth.error);
    if (message === sv.auth.rateLimited || message === sv.auth.invalidEmail) return { ok: false, error: message };
  }
  return { ok: true, message: sv.auth.forgotSent };
}

export async function updatePasswordAction(formData: FormData): Promise<AuthResult> {
  const sv = await getT();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { ok: false, error: sv.auth.weakPassword };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: sv.auth.error };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: authErrorMessage(sv, error, sv.errors.generic) };
  return { ok: true, message: sv.account.passwordSaved };
}

/**
 * Byte av e-postadress under Konto. Supabase skickar en bekräftelselänk till båda adresserna
 * (Secure email change, docs/DEPLOY.md; mallen supabase/templates/email_change.html), och
 * adressen byts först när båda länkarna öppnats (/auth/confirm, type=email_change).
 */
export async function updateEmailAction(formData: FormData): Promise<AuthResult> {
  const sv = await getT();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, error: sv.auth.invalidEmail };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: sv.auth.error };
  if (email === (user.email ?? "").toLowerCase()) return { ok: false, error: sv.account.emailSame };
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { ok: false, error: authErrorMessage(sv, error, sv.errors.generic) };
  return { ok: true, message: sv.account.emailChangeSent(email) };
}

export async function updateDisplayNameAction(formData: FormData): Promise<AuthResult> {
  const sv = await getT();
  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 80);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: sv.auth.error };
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName || null })
    .eq("id", user.id);
  if (error) return { ok: false, error: sv.errors.generic };
  revalidatePath(routes.account());
  return { ok: true, message: sv.account.saved };
}

/**
 * Veckobrevsvalet under Konto → Mejl (bara examinatorer ser formuläret). Bara egna raden (RLS)
 * och bara digest_email: formuläret skickar inget annat, så inget annat skrivs.
 */
export async function updateEmailPrefsAction(formData: FormData): Promise<AuthResult> {
  const sv = await getT();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: sv.auth.error };
  if (formData.has("digest_form")) {
    const { error } = await supabase
      .from("profiles")
      .update({ digest_email: formData.get("digest_email") === "on" })
      .eq("id", user.id);
    if (error) return { ok: false, error: sv.errors.generic };
  }
  revalidatePath(routes.account());
  return { ok: true, message: sv.account.saved };
}

export async function deleteAccountAction(): Promise<AuthResult> {
  const sv = await getT();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: sv.auth.error };
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, error: sv.errors.generic };
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(routes.landing({ raderad: true }));
}
