"use client";

/**
 * Sign-in ON THE FRONT DOOR. There is no separate sign-in page any more: this
 * card is the last beat of the scroll scene, so a visitor reads what the product
 * does and then signs in without leaving the page.
 *
 * It is the same auth as the workspace (email + password, or a magic link, plus
 * Google when the platform has wired it) wearing the scene's clothes: a white
 * plate with a hairline navy edge, uppercase tracked labels, square corners. The
 * workspace panel's rounded card would read as a different product bolted on.
 *
 * `active` gates pointer events — while the beat is faded out the card is
 * invisible, and an invisible form that still swallows clicks is how the scroll
 * above it stops responding.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, signInWithGoogle } from "@/lib/auth-client";

const DARK = "#1D3045";

const FIELD =
  "h-11 rounded-none border-0 border-b bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0 focus-visible:border-b-2";

export function SceneSignIn({
  active,
  googleEnabled,
}: {
  active: boolean;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [useLink, setUseLink] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const done = () => {
    startTransition(() => {
      router.push("/start");
      router.refresh();
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (useLink) {
        const result = await authClient.signIn.magicLink({
          email,
          callbackURL: "/start",
        });
        if (result.error) throw new Error(result.error.message ?? "That didn't work.");
        setSent(true);
        return;
      }
      const result = isNew
        ? await authClient.signUp.email({
            email,
            password,
            name: email.split("@")[0],
          })
        : await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message ?? "That didn't work.");
      done();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle("/start");
      done();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const working = busy || pending;

  return (
    <div
      id="sign-in"
      className={`w-full max-w-[400px] bg-white ${active ? "pointer-events-auto" : "pointer-events-none"}`}
      style={{ border: `1px solid ${DARK}`, color: DARK }}
    >
      <div
        className="flex min-w-0 items-baseline justify-between gap-3 px-6 pt-6"
        style={{ color: DARK }}
      >
        <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.22em]">
          {isNew ? "Create your account" : "Sign in"}
        </span>
        <span className="shrink-0 text-[11px] uppercase tracking-[0.22em] opacity-50">
          IOAA.AI
        </span>
      </div>

      <form onSubmit={submit} className="px-6 pb-6 pt-5">
        <div className="space-y-1.5">
          <Label
            htmlFor="scene-email"
            className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-60"
          >
            Work email
          </Label>
          <Input
            id="scene-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            className={FIELD}
            style={{ borderColor: `${DARK}40`, color: DARK }}
          />
        </div>

        {useLink ? null : (
          <div className="mt-5 space-y-1.5">
            <Label
              htmlFor="scene-password"
              className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-60"
            >
              Password
            </Label>
            <Input
              id="scene-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isNew ? "new-password" : "current-password"}
              placeholder="At least 8 characters"
              className={FIELD}
              style={{ borderColor: `${DARK}40`, color: DARK }}
            />
          </div>
        )}

        {error ? (
          <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: "#a4262c" }}>
            {error}
          </p>
        ) : null}
        {sent ? (
          <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: DARK }}>
            Check your inbox — that link signs you straight in.
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={working}
          className="mt-6 h-11 w-full rounded-none text-[11px] font-medium uppercase tracking-[0.2em]"
          style={{ background: DARK, color: "#ffffff" }}
        >
          {working
            ? "One moment…"
            : useLink
              ? "Email me a link"
              : isNew
                ? "Create account"
                : "Sign in"}
        </Button>

        {googleEnabled ? (
          <Button
            type="button"
            onClick={google}
            disabled={working}
            className="mt-2.5 h-11 w-full rounded-none bg-transparent text-[11px] font-medium uppercase tracking-[0.2em] hover:bg-black/[0.04]"
            style={{ border: `1px solid ${DARK}40`, color: DARK }}
          >
            Continue with Google
          </Button>
        ) : null}

        <div className="mt-5 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={() => {
              setIsNew((value) => !value);
              setError(null);
            }}
            className="min-w-0 truncate text-[10.5px] uppercase tracking-[0.18em] underline decoration-1 underline-offset-4 opacity-60 transition-opacity hover:opacity-100"
          >
            {isNew ? "I already have an account" : "I'm new here"}
          </button>
          <button
            type="button"
            onClick={() => {
              setUseLink((value) => !value);
              setError(null);
              setSent(false);
            }}
            className="min-w-0 truncate text-[10.5px] uppercase tracking-[0.18em] underline decoration-1 underline-offset-4 opacity-60 transition-opacity hover:opacity-100"
          >
            {useLink ? "Use a password" : "Email me a link"}
          </button>
        </div>
      </form>
    </div>
  );
}
