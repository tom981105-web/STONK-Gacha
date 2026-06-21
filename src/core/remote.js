// src/core/remote.js — STONK Gacha 공통 Firebase 연동 (cash/inventory/dust/stats)
// ───────────────────────────────────────────────────────────────────
// PHASE 2: Gacha 의 자체 money(localStorage) 대신 Battle/Arcade 와 같은
//   rooms/{roomCode}/players/{uid}/cash 를 실제 재화로 사용한다.
// 같은 GitHub Pages origin(tom981105-web.github.io)이라 Battle 의 이메일
//   로그인 세션이 자동 복원되어 같은 uid → cash 가 3사이트에서 공유된다.
//
// 저장 구조:
//   rooms/{code}/players/{uid}/cash            (number)  ← Battle/Arcade 공통
//   rooms/{code}/players/{uid}/gachaInventory  {itemId:count}
//   rooms/{code}/players/{uid}/dust            (number)
//   rooms/{code}/players/{uid}/gachaStats      {totalDraws,drawCountToday,lastVisitDate,...}
//   rooms/{code}/players/{uid}/gachaShop       {itemId:count}  (Dust 상점 보유)
//   rooms/{code}/gachaLogs/{pushId}            {uid,nickname,name,grade,...}  (방 획득 피드)
//
// Firebase 사용량 정책: 입장 1회 로드 + 결과 확정 시점에만 update.
//   - 뽑기: cash 트랜잭션 1회 + gacha 서브트리 update 1회 + 방 로그 push 1회.
//   - 10연차도 한 번의 update 로 처리(개별 쓰기 금지).

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getDatabase, ref, get, update, runTransaction, push,
  query, orderByKey, limitToLast,
} from "firebase/database";

export const firebaseConfig = {
  apiKey: "AIzaSyARFa-vzKVmIdxP5xDRXVzasL2ui94eZ-w",
  authDomain: "market-6e66a.firebaseapp.com",
  databaseURL: "https://market-6e66a-default-rtdb.firebaseio.com",
  projectId: "market-6e66a",
  storageBucket: "market-6e66a.firebasestorage.app",
  messagingSenderId: "402312269082",
  appId: "1:402312269082:web:cf304afc54057ea162b0a3",
};

export const isConfigured =
  Boolean(firebaseConfig.apiKey) &&
  !String(firebaseConfig.apiKey).startsWith("여기에") &&
  Boolean(firebaseConfig.databaseURL) &&
  !String(firebaseConfig.databaseURL).startsWith("여기에");

// Battle/Arcade 와 동일한 신규 유저 시작 자본 (공통 경제 일관성)
export const DEFAULT_CASH = 10_000_000;

let app, auth, db;

export function getFirebase() {
  if (!isConfigured) throw new Error("Firebase 설정이 비어 있습니다.");
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
  }
  return { app, auth, db };
}

// PHASE 3: 익명 로그인을 만들지 않고 현재(또는 복원되는) 세션만 1회 확인.
export function getCurrentUserOnce() {
  const { auth } = getFirebase();
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u || null); }, () => resolve(null));
  });
}

// 기존 로그인 세션(=Battle 이메일 계정) 우선 재사용, 없으면 익명 로그인.
export function ensureUser() {
  const { auth } = getFirebase();
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    let done = false;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (done) return;
      if (user) { done = true; unsub(); resolve(user); return; }
      try {
        const cred = await signInAnonymously(auth);
        done = true; unsub(); resolve(cred.user);
      } catch (e) { done = true; unsub(); reject(e); }
    }, reject);
  });
}

// ---- roomCode 유틸 (PHASE 1 SiteConfig 규약과 동일) ----
export const LAST_ROOM_KEY = "stonk:lastRoomCode";
const LEGACY_ROOM_KEYS = ["mb_roomCode", "mb-board-room", "wiki-room", "lastRoomCode", "roomCode"];

export function normalizeRoomCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getUrlRoomCode() {
  try {
    const p = new URLSearchParams(location.search);
    return normalizeRoomCode(p.get("room") || p.get("roomCode") || p.get("roomId") || "");
  } catch (e) { return ""; }
}

export function getStoredRoomCode() {
  try {
    const main = normalizeRoomCode(localStorage.getItem(LAST_ROOM_KEY));
    if (main) return main;
    for (const k of LEGACY_ROOM_KEYS) {
      const v = normalizeRoomCode(localStorage.getItem(k));
      if (v) return v;
    }
  } catch (e) {}
  return "";
}

export function saveRoomCode(code) {
  const c = normalizeRoomCode(code);
  if (!c) return;
  try {
    localStorage.setItem(LAST_ROOM_KEY, c);
    localStorage.setItem("mb_roomCode", c);
    localStorage.setItem("mb-board-room", c);
    localStorage.setItem("wiki-room", c);
  } catch (e) {}
}

const P = (roomCode, uid) => `rooms/${roomCode}/players/${uid}`;

// v2.5: Gacha 폭망 보호권 실연동.
// 10회 뽑기에서 Epic 이상 0개 또는 Common 8개 이상이고 활성 'gacha' 보험이 있으면 Dust +300(1회).
// 결과/확률/천장은 건드리지 않고, 정산 후 Dust 보상만 추가. 실패해도 뽑기는 정상 진행되도록 방어.
export async function claimGachaGuard(roomCode, uid, grades) {
  try {
    if (!Array.isArray(grades) || grades.length < 10) return 0;
    const epicPlus = grades.filter((g) => g === "Epic" || g === "Legendary" || g === "Mythic").length;
    const commons = grades.filter((g) => g === "Common").length;
    if (!(epicPlus === 0 || commons >= 8)) return 0;
    const { db } = getFirebase();
    const now = Date.now();
    const bankSnap = await get(ref(db, `rooms/${roomCode}/bank/${uid}`));
    const inss = (bankSnap.val() || {}).insurances || {};
    const entry = Object.entries(inss).find(([, i]) => i && i.type === "gacha" && i.status === "active" && !i.usedAt && Number(i.expiresAt || 0) > now);
    if (!entry) return 0;
    const [insId] = entry;
    const reward = 300;
    await runTransaction(ref(db, `${P(roomCode, uid)}/dust`), (d) => Math.max(0, Math.trunc(Number(d || 0))) + reward);
    await update(ref(db, `rooms/${roomCode}/bank/${uid}/insurances/${insId}`), { status: "used", usedAt: now });
    await push(ref(db, `rooms/${roomCode}/bank/${uid}/tx`), { type: "insurance_used", title: "Gacha 폭망 보호권 적용", amount: reward, beforeCash: 0, afterCash: 0, memo: "10회 뽑기 결과 보호 보상 Dust 지급", createdAt: now });
    await push(ref(db, `rooms/${roomCode}/bank/${uid}/messages`), { type: "insurance", title: "Gacha 보호권 사용됨", body: "10회 뽑기 결과 조건 충족으로 Dust 300이 지급되었습니다.", amount: reward, relatedId: "insused-" + insId, read: false, actionLabel: "", actionUrl: "", createdAt: now });
    return reward;
  } catch (e) { console.warn("[gacha] 보호권 처리 실패:", e); return -1; }
}

// v2.9: 카드 상태 조회(결제 옵션 표시용). 실패 시 null → 카드 옵션 숨김.
export async function loadCardStatus(roomCode, uid) {
  try {
    const { db } = getFirebase();
    const snap = await get(ref(db, `rooms/${roomCode}/bank/${uid}/card`));
    const c = snap.val() || {};
    const limit = Math.trunc(Number(c.cardLimit) || 0), used = Math.trunc(Number(c.usedAmount) || 0);
    return { enabled: !!c.enabled, suspended: !!c.suspended, overdue: !!c.overdue, tier: c.cardTier || "", limit, used, remaining: Math.max(0, limit - used) };
  } catch (_) { return null; }
}
// v2.9: 카드 결제. 반환: 결제액(성공) / -1 정지·미발급 / -2 한도초과 / 0 무효
export async function chargeCard(roomCode, uid, amount, label) {
  try {
    amount = Math.max(0, Math.trunc(Number(amount) || 0));
    if (amount <= 0) return 0;
    const { db } = getFirebase();
    const now = Date.now();
    const c = (await get(ref(db, `rooms/${roomCode}/bank/${uid}/card`))).val() || {};
    if (!c.enabled || c.suspended) return -1;
    const limit = Math.trunc(Number(c.cardLimit) || 0), used = Math.trunc(Number(c.usedAmount) || 0);
    if (used + amount > limit) return -2;
    const dueAt = Number(c.dueAt) > 0 ? Number(c.dueAt) : now + 24 * 3600 * 1000;
    await update(ref(db, `rooms/${roomCode}/bank/${uid}/card`), { usedAmount: used + amount, dueAt, updatedAt: now });
    await push(ref(db, `rooms/${roomCode}/bank/${uid}/tx`), { type: "card_use", title: label || "카드 결제", amount: -amount, beforeCash: 0, afterCash: 0, memo: "게임머니 카드 결제(청구 예정)", createdAt: now });
    await push(ref(db, `rooms/${roomCode}/bank/${uid}/messages`), { type: "card", title: "STONK Card 결제", body: `${label || "카드 결제"} ${amount.toLocaleString("ko-KR")}원이 카드로 결제되었습니다(청구 예정).`, amount: -amount, relatedId: "", read: false, actionLabel: "", actionUrl: "", createdAt: now });
    return amount;
  } catch (e) { console.warn("[gacha] 카드 결제 실패:", e); return -1; }
}

// v2.0: 은행 대출 상태 1회 조회(표시 전용). 가챠 로직에는 영향 없음.
export async function loadBankLoan(roomCode, uid) {
  try {
    const { db } = getFirebase();
    const snap = await get(ref(db, `rooms/${roomCode}/bank/${uid}`));
    const b = snap.val() || {};
    return Math.max(0, Math.trunc(Number(b.loanPrincipal || 0) + Number(b.loanInterest || 0)));
  } catch (_) { return 0; }
}

// 플레이어 노드 1회 로드. 없으면 시작 자본으로 생성(Battle 미참여 유저도 가챠 가능).
export async function loadGachaPlayer(roomCode, uid) {
  const { db } = getFirebase();
  const playerRef = ref(db, P(roomCode, uid));
  const snap = await get(playerRef);
  const v = snap.val() || {};

  let cash = v.cash ?? v.money ?? v.balance ?? v.capital;
  if (cash === undefined || cash === null) {
    // cash 필드가 없으면(신규 또는 별칭만 존재) 시작 자본으로 보강
    cash = DEFAULT_CASH;
    await update(playerRef, { cash, createdFrom: v.createdFrom || "STONK Gacha", createdAt: v.createdAt || Date.now() });
  }
  return {
    uid,
    nickname: v.nickname || v.name || v.playerName || `Player-${uid.slice(0, 4)}`,
    cash: Math.trunc(Number(cash) || 0),
    gachaInventory: isObj(v.gachaInventory) ? v.gachaInventory : {},
    dust: Math.max(0, Math.trunc(Number(v.dust) || 0)),
    gachaStats: isObj(v.gachaStats) ? v.gachaStats : {},
    gachaShop: isObj(v.gachaShop) ? v.gachaShop : {},
  };
}

// 뽑기 비용 차감 — 동시성 안전(트랜잭션). 부족하면 throw. 성공 시 차감 후 cash 반환.
export async function spendCash(roomCode, uid, cost, fallbackCash = 0) {
  const { db } = getFirebase();
  const amount = Math.max(0, Math.trunc(Number(cost) || 0));
  const fallback = Math.max(0, Math.trunc(Number(fallbackCash) || 0));
  const cashRef = ref(db, `${P(roomCode, uid)}/cash`);
  const tx = await runTransaction(cashRef, (cur) => {
    const base = cur === null || cur === undefined ? fallback : Math.trunc(Number(cur) || 0);
    if (base < amount) return; // 중단 → 잔액 부족
    return base - amount;
  });
  if (!tx.committed) {
    const err = new Error("INSUFFICIENT_CASH");
    err.code = "INSUFFICIENT_CASH";
    throw err;
  }
  return Math.trunc(Number(tx.snapshot.val()) || 0);
}

// gacha 서브트리(인벤토리/더스트/스탯/상점)를 한 번의 update 로 저장.
export async function savePlayerGacha(roomCode, uid, { gachaInventory, dust, gachaStats, gachaShop }) {
  const { db } = getFirebase();
  const updates = {};
  if (gachaInventory !== undefined) updates.gachaInventory = pruneCounts(gachaInventory);
  if (dust !== undefined) updates.dust = Math.max(0, Math.trunc(Number(dust) || 0));
  if (gachaStats !== undefined) updates.gachaStats = gachaStats;
  if (gachaShop !== undefined) updates.gachaShop = pruneCounts(gachaShop);
  if (!Object.keys(updates).length) return;
  await update(ref(db, P(roomCode, uid)), updates);
}

// 방 획득 피드에 1건 push (뽑기당 대표 1건). 입장 시 limitToLast 로만 읽음.
export async function pushGachaLog(roomCode, entry) {
  try {
    const { db } = getFirebase();
    await push(ref(db, `rooms/${roomCode}/gachaLogs`), { ...entry, createdAt: Date.now() });
  } catch (e) { /* 로그 실패는 치명적이지 않음 */ }
}

export async function loadGachaLogs(roomCode, max = 20) {
  try {
    const { db } = getFirebase();
    const snap = await get(query(ref(db, `rooms/${roomCode}/gachaLogs`), orderByKey(), limitToLast(max)));
    const val = snap.val() || {};
    return Object.values(val).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (e) { return []; }
}

function isObj(v) { return Boolean(v) && typeof v === "object" && !Array.isArray(v); }
function pruneCounts(obj) {
  const out = {};
  for (const [k, n] of Object.entries(obj || {})) {
    const c = Math.max(0, Math.floor(Number(n) || 0));
    if (c > 0) out[k] = c;
  }
  return out;
}
