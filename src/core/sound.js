// src/core/sound.js — Web Audio 기반 간단 효과음 (외부 음원 0, 라이선스 무관)
// 기본 음량 작게, 음소거 토글 제공, localStorage 로 상태 유지.
const MUTE_KEY = "stonk:soundMuted";
let ctx = null;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (e) {}

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = Boolean(v);
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (e) {}
}
export function toggleMuted() { setMuted(!muted); return muted; }

function ac() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch (e) { return null; }
}

// 단순 톤 1개 재생
function tone(freq, dur = 0.12, type = "sine", gain = 0.05, when = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// 상승 글리산도(노이즈 대용) — 머신 가동/회전감
function sweep(from, to, dur = 0.4, type = "sawtooth", gain = 0.04) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  click() { tone(420, 0.06, "square", 0.04); },
  insert() { tone(700, 0.08, "square", 0.05); tone(520, 0.1, "square", 0.04, 0.06); },
  crank() { sweep(180, 90, 0.5, "sawtooth", 0.035); },
  pop() { tone(880, 0.09, "triangle", 0.06); tone(1320, 0.12, "sine", 0.05, 0.05); },
  common() { tone(440, 0.12, "sine", 0.05); },
  rare() { tone(523, 0.12, "triangle", 0.06); tone(659, 0.14, "triangle", 0.05, 0.08); },
  epic() { [523, 659, 784].forEach((f, i) => tone(f, 0.14, "triangle", 0.06, i * 0.08)); },
  legendary() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "sawtooth", 0.05, i * 0.09)); },
  mythic() { [659, 880, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, "sawtooth", 0.06, i * 0.1)); sweep(400, 1600, 0.7, "sine", 0.04); },
  coin() { tone(988, 0.07, "square", 0.05); tone(1319, 0.1, "square", 0.045, 0.05); },
  fail() { tone(220, 0.2, "sawtooth", 0.05); tone(160, 0.28, "sawtooth", 0.045, 0.08); },
  dust() { tone(740, 0.08, "triangle", 0.05); tone(560, 0.12, "triangle", 0.04, 0.06); },
};
