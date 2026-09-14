"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/supabase/request-origin";
import { sv } from "@/lib/i18n/sv";
import { safeNext } from "./safe-next";

export type AuthResult = { ok: true; message?: string } | { ok: false; error: string };

/** Översätter Supabase Auth-fel till begripliga meddelanden och loggar orsaken (syns i Vercel-loggen). */
function authErrorMessage(error: { message: string; code?: string }, fallback: string): string {
  const code = (error.code ?? "").toLowerCase();
  const msg = error.message.toLowerCase();
  console.error("[auth]", error.code ?? "", error.message);
  if (code.includes("rate_limit") || msg.includes("rate limit")) return sv.auth.rateLimited;
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already") || msg.includes("registered")) return sv.auth.emailInUse;
  if (code === "signup_disabled" || msg.includes("signups not allowed")) return sv.auth.signupDisabled;
  if (code === "validation_failed" || code === "email_address_invalid" || msg.includes("invalid email") || msg.includes("unable to validate email")) {
    return sv.auth.invalidEmail;
  }
  if (code === "weak_password" || msg.includes("password")) return sv.auth.weakPassword;
  return fallback;
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signInWithPasswordAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  if (!email || !password) return { ok: false, error: sv.auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const code = (error.code ?? "").toLowerCase();
    if (code === "email_not_confirmed") return { ok: false, error: sv.auth.notConfirmed };
    return { ok: false, error: authErrorMessage(error, sv.auth.invalidCredentials) };
  }
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const next = safeNext(formData.get("next"));
  if (!email) return { ok: false, error: sv.auth.error };
  if (password.length < 8) return { ok: false, error: sv.auth.weakPassword };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: `${await getRequestOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, error: authErrorMessage(error, sv.auth.error) };
  // Med e-postbekräftelse avstängd finns en session direkt.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }
  // Supabase returnerar en "fejkad" användare utan identities när e-posten redan finns.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { ok: false, error: sv.auth.emailInUse };
  }
  return { ok: true, message: sv.auth.checkEmail };
}

export async function sendMagicLinkAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNext(formData.get("next"));
  if (!email) return { ok: false, error: sv.auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await getRequestOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, error: authErrorMessage(error, sv.auth.error) };
  return { ok: true, message: sv.auth.magicLinkSent };
}

export async function updateDisplayNameAction(formData: FormData): Promise<AuthResult> {
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
  revalidatePath("/konto");
  return { ok: true, message: sv.account.saved };
}

export async function deleteAccountAction(): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: sv.auth.error };
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, error: sv.errors.generic };
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?raderad=1");
}
