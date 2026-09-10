import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin_/login")({
  validateSearch: (s: Record<string, unknown>) => {
    const r = typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : "/admin";
    return { redirect: r };
  },
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: roles } = await supabase
        .from("user_roles" as never)
        .select("role")
        .eq("user_id", data.user.id);
      const isAdmin = (roles as Array<{ role: string }> | null)?.some(
        (r) => r.role === "admin",
      );
      const target = search.redirect && search.redirect !== "/admin/login" ? search.redirect : "/admin";
      if (isAdmin) throw redirect({ to: target });
    }
  },
  head: () => ({
    meta: [{ title: "Entrar — TonTon Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminLogin,
});

const ADMIN_EMAIL = "diretorios.tonton@gmail.com";

function AdminLogin() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        if (email !== ADMIN_EMAIL) {
          toast.error("Apenas o email da TonTon pode criar conta admin.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        const userId = data.user?.id;
        if (userId) {
          // primeira conta vira admin
          await supabase
            .from("user_roles" as never)
            .insert({ user_id: userId, role: "admin" } as never);
        }
        toast.success("Conta criada! Entrando...");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // confirma admin
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: roles } = await supabase
          .from("user_roles" as never)
          .select("role")
          .eq("user_id", u.user.id);
        const isAdmin = (roles as Array<{ role: string }> | null)?.some(
          (r) => r.role === "admin",
        );
        if (!isAdmin) {
          // se for o email oficial e ainda não tem role, atribui
          if (u.user.email === ADMIN_EMAIL) {
            await supabase
              .from("user_roles" as never)
              .insert({ user_id: u.user.id, role: "admin" } as never);
          } else {
            toast.error("Esse usuário não é admin.");
            await supabase.auth.signOut();
            return;
          }
        }
      }
      navigate({ to: search.redirect });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao entrar";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-sm"
      >
        <div className="mb-5 flex items-center gap-2">
          <Heart className="h-7 w-7 fill-primary text-primary" />
          <div>
            <h1 className="font-display text-xl">TonTon Admin</h1>
            <p className="text-xs text-muted-foreground">
              Acesso restrito da loja
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1"
              autoComplete="email"
            />
          </div>
          <div>
            <Label>Senha</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
            {mode === "signup" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Mínimo 8 caracteres. Use uma senha forte.
              </p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          disabled={busy}
          size="lg"
          className="mt-5 w-full bg-primary text-primary-foreground hover:bg-primary-glow"
        >
          {busy ? "Aguarde..." : mode === "signup" ? "Criar conta admin" : "Entrar"}
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-primary"
        >
          {mode === "login"
            ? "Primeira vez? Criar conta admin"
            : "Já tem conta? Entrar"}
        </button>

        {mode === "login" && (
          <button
            type="button"
            onClick={async () => {
              if (!email) {
                toast.error("Digite seu email primeiro.");
                return;
              }
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + "/reset-password",
              });
              if (error) toast.error(error.message);
              else toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
            }}
            className="mt-2 w-full text-center text-xs text-primary hover:underline"
          >
            Esqueci minha senha
          </button>
        )}
      </form>
    </div>
  );
}
