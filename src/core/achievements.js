// STONK Gacha — 도전과제 (Achievements)
// 기존 state 통계에서 진행도를 계산. 달성 시 Dust 1회 보상(중복 수령 방지).
import { collections } from "../data/collections.js";

const DEFS = [
  { id: "first-pull",     icon: "🎯", name: "첫 캡슐",      desc: "캡슐을 1회 뽑기",            goal: 1,    reward: 200,   metric: "totalDraws" },
  { id: "high-roller",    icon: "💰", name: "큰손",         desc: "누적 100회 뽑기",            goal: 100,  reward: 1500,  metric: "totalDraws" },
  { id: "whale",          icon: "🐋", name: "고래",         desc: "누적 500회 뽑기",            goal: 500,  reward: 8000,  metric: "totalDraws" },
  { id: "collector-10",   icon: "📦", name: "수집의 시작",   desc: "컬렉션 10종 보유",           goal: 10,   reward: 500,   metric: "owned" },
  { id: "collector-30",   icon: "🗂️", name: "수집가",       desc: "컬렉션 30종 보유",           goal: 30,   reward: 1800,  metric: "owned" },
  { id: "legendary",      icon: "👑", name: "고급 취향",     desc: "Legendary 1종 보유",         goal: 1,    reward: 2000,  metric: "legendary" },
  { id: "mythic",         icon: "🌌", name: "신화 등극",     desc: "Mythic 1종 보유",            goal: 1,    reward: 6000,  metric: "mythic" },
  { id: "refiner",        icon: "♻️", name: "정제공",        desc: "누적 50개 분해",             goal: 50,   reward: 1000,  metric: "totalDismantled" },
  { id: "alchemist",      icon: "⚗️", name: "연성술사",      desc: "합성 1회 성공",              goal: 1,    reward: 1500,  metric: "totalFused" },
  { id: "completionist",  icon: "🏆", name: "도감 마스터",   desc: "모든 컬렉션 수집",            goal: collections.length, reward: 20000, metric: "owned" }
];

function metricValue(state, metric) {
  switch (metric) {
    case "totalDraws": return Number(state.totalDraws) || 0;
    case "totalDismantled": return Number(state.totalDismantled) || 0;
    case "totalFused": return Number(state.totalFused) || 0;
    case "owned": return collections.filter((i) => state.collection[i.id]).length;
    case "legendary": return collections.filter((i) => i.grade === "Legendary" && state.collection[i.id]).length;
    case "mythic": return collections.filter((i) => i.grade === "Mythic" && state.collection[i.id]).length;
    default: return 0;
  }
}

export function getAchievements(state) {
  const claimed = Array.isArray(state.achievementsClaimed) ? state.achievementsClaimed : [];
  return DEFS.map((def) => {
    const value = metricValue(state, def.metric);
    const done = value >= def.goal;
    return {
      ...def,
      progress: Math.min(value, def.goal),
      value,
      done,
      claimed: claimed.includes(def.id),
      claimable: done && !claimed.includes(def.id)
    };
  });
}

export function getAchievementSummary(state) {
  const list = getAchievements(state);
  return {
    total: list.length,
    done: list.filter((a) => a.done).length,
    claimable: list.filter((a) => a.claimable).length
  };
}

export function claimAchievement(state, id) {
  const def = DEFS.find((d) => d.id === id);
  if (!def) return { ok: false, reason: "UNKNOWN" };
  const value = metricValue(state, def.metric);
  if (value < def.goal) return { ok: false, reason: "NOT_DONE" };
  state.achievementsClaimed = Array.isArray(state.achievementsClaimed) ? state.achievementsClaimed : [];
  if (state.achievementsClaimed.includes(id)) return { ok: false, reason: "ALREADY_CLAIMED" };
  state.achievementsClaimed.push(id);
  state.dust = (Number(state.dust) || 0) + def.reward;
  return { ok: true, reward: def.reward, name: def.name };
}
