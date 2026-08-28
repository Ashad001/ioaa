"use client";

/**
 * Sign-in, in the rack's own vocabulary. Email + password and a magic link, both
 * against the app's own database.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KeyRound, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lamp, Plate } from "@/components/rack/plate";
import { authClient } from "@/lib/auth-client";

export function SignInPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<"password" | "link">("password");
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "link") {
        const result = await authClient.signIn.magicLink({ email, callbackURL: "/library" });
        if (result.error) throw new Error(result.error.message ?? "That didn't work.");
        setSent(true);
        return;
      }
      const result = isNew
        ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] })
        : await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message ?? "That didn't work.");
      startTransition(() => {
        router.push("/library");
        router.refresh();
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel w-full max-w-[380px] rounded-sm">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <Lamp state="hold" />
        <Plate className="text-foreground">Sign in to IOAA.AI</Plate>
      </div>

      <div className="px-5 py-5">
        <Tabs value={mode} onValueChange={(value) => setMode(value as "password" | "link")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password" className="min-w-0">
              <KeyRound size={13} strokeWidth={1.6} />
              <span className="min-w-0 truncate">Password</span>
            </TabsTrigger>
            <TabsTrigger value="link" className="min-w-0">
              <Mail size={13} strokeWidth={1.6} />
              <span className="min-w-0 truncate">Email link</span>
            </TabsTrigger>
          </TabsList>

          <form onSubmit={submit} className="mt-4 space-y-3.5">
            <TabsContent value="password" className="space-y-3.5">
              {isNew ? (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </div>
              ) : null}
            </TabsContent>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
              />
            </div>

            {mode === "password" ? (
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isNew ? "new-password" : "current-password"}
                  placeholder="At least 8 characters"
                />
              </div>
            ) : null}

            {error ? <p className="text-[13px] leading-relaxed text-destructive">{error}</p> : null}
            {sent ? (
              <p className="text-[13px] leading-relaxed text-lamp-live">
                Check your inbox — the link signs you straight in.
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy || pending}>
              {busy || pending
                ? "One moment…"
                : mode === "link"
                  ? "Email me a link"
                  : isNew
                    ? "Create account"
                    : "Sign in"}
            </Button>
          </form>
        </Tabs>

        {mode === "password" ? (
          <button
            type="button"
            onClick={() => {
              setIsNew((value) => !value);
              setError(null);
            }}
            className="mt-3.5 w-full text-center text-xs text-muted-foreground underline decoration-rack-seam transition-colors hover:text-foreground"
          >
            {isNew ? "I already have an account" : "I'm new — create an account"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
