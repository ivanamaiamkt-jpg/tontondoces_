import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Redefinir senha" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase coloca o token de recovery no hash da URL e dispara onAuthStateChange
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada! Entrando...");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar senha");
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
            <h1 className="font-display text-xl">Nova senha</h1>
            <p className="text-xs text-muted-foreground">
              Defina uma nova senha pra sua conta
            </p>
          </div>
        </div>

        {!ready ? (
          <p className="text-sm text-muted-foreground">
            Abra esta página pelo link enviado no seu email.
          </p>
        ) : (
          <>
            <div>
              <Label>Nova senha</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="mt-1"
                minLength={8}
                required
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
            </div>
            <Button
              type="submit"
              disabled={busy}
              size="lg"
              className="mt-5 w-full bg-primary text-primary-foreground hover:bg-primary-glow"
            >
              {busy ? "Aguarde..." : "Salvar nova senha"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
