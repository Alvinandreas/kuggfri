"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";
import { sv } from "@/lib/i18n/sv";

export type AuthResult = { ok: true; message?: string } | { ok: false; error: string };

function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/";
  // Endast interna sökvägar.
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
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
    return { ok: false, error: sv.auth.invalidCredentials };
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
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return { ok: false, error: sv.auth.emailInUse };
    }
    if (msg.includes("password")) return { ok: false, error: sv.auth.weakPassword };
    return { ok: false, error: sv.auth.error };
  }
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
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, error: sv.auth.error };
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
