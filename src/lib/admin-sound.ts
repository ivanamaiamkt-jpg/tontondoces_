// Som do aviso de pedido novo no painel. Navegadores só deixam tocar som depois que a pessoa
// toca/clica na página uma vez; por isso o áudio é "destravado" no primeiro gesto.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    ctx = new Ctx();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Destrava o áudio (chamar dentro de um clique/toque). */
export async function unlockAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
  } catch {
    // ignore
  }
  return c.state === "running";
}

/** true enquanto o navegador ainda não liberou o som. */
export function isAudioBlocked(): boolean {
  return !ctx || ctx.state !== "running";
}

/** Instala um "destravador": o primeiro toque/tecla em qualquer lugar da página libera o som. */
export function installAudioUnlock(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    void unlockAudio();
  };
  window.addEventListener("pointerdown", handler, { once: true });
  window.addEventListener("keydown", handler, { once: true });
  return () => {
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };
}

function tone(c: AudioContext, freq: number, start: number, dur: number, volume: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
}

/** Toque de pedido novo: três notas, mais alto e comprido que um "bip" (difícil de não ouvir). */
export function playOrderSound() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  if (c.state !== "running") return;
  const t = c.currentTime + 0.02;
  tone(c, 880, t, 0.28, 0.45);
  tone(c, 1175, t + 0.3, 0.28, 0.45);
  tone(c, 1568, t + 0.6, 0.5, 0.45);
}
