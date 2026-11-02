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

const masters = new WeakMap<BaseAudioContext, GainNode>();

/** Saída comum do toque: tira o chiado agudo e passa por um compressor, que deixa o som bem mais
 * forte (e constante) sem estourar o alto-falante do computador. */
function master(c: BaseAudioContext): GainNode {
  let g = masters.get(c);
  if (g) return g;
  g = c.createGain();
  const lowpass = c.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 4500;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.knee.value = 10;
  comp.ratio.value = 12;
  comp.attack.value = 0.002;
  comp.release.value = 0.15;
  // O compressor já nivela o som perto do máximo; este ganho final usa a folga que sobra (pico ≈ -1 dB).
  const boost = c.createGain();
  boost.gain.value = 1.7;
  g.connect(lowpass);
  lowpass.connect(comp);
  comp.connect(boost);
  boost.connect(c.destination);
  masters.set(c, g);
  return g;
}

function tone(
  c: BaseAudioContext,
  freq: number,
  start: number,
  dur: number,
  volume: number,
  type: OscillatorType,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  g.gain.setValueAtTime(volume, start + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(master(c));
  o.start(start);
  o.stop(start + dur + 0.05);
}

/** Toque de pedido novo: três "campainhas" de duas notas (uns 2 s). Onda quadrada + grave por baixo
 * soa bem mais alto que a senoide antiga e se ouve até com barulho de cozinha. */
export function scheduleOrderSound(c: BaseAudioContext, t: number) {
  for (let i = 0; i < 3; i++) {
    const s = t + i * 0.75;
    tone(c, 1568, s, 0.22, 0.5, "square");
    tone(c, 784, s, 0.22, 0.3, "triangle");
    tone(c, 1175, s + 0.24, 0.42, 0.5, "square");
    tone(c, 587, s + 0.24, 0.42, 0.3, "triangle");
  }
}

export function playOrderSound() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  if (c.state !== "running") return;
  scheduleOrderSound(c, c.currentTime + 0.02);
}
