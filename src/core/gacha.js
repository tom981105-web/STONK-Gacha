import { collections, GRADE_ORDER } from "../data/collections.js";

export const CAPSULES = {
  normal: {
    id: "normal",
    name: "Normal Capsule",
    tone: "green",
    singleCost: 1000000,
    tenCost: 10000000,
    rates: {
      Common: 60,
      Rare: 27,
      Epic: 10,
      Legendary: 2.7,
      Mythic: 0.3
    }
  },
  premium: {
    id: "premium",
    name: "Premium Capsule",
    tone: "gold",
    singleCost: 5000000,
    tenCost: 50000000,
    rates: {
      Common: 35,
      Rare: 35,
      Epic: 20,
      Legendary: 8,
      Mythic: 2
    }
  }
};

const RARE_OR_ABOVE = new Set(["Rare", "Epic", "Legendary", "Mythic"]);
const LEGENDARY_OR_ABOVE = new Set(["Legendary", "Mythic"]);

// 천장(Pity): 이 횟수 안에 Legendary 이상이 반드시 나온다. 뽑는 목적·기대감 강화.
export const PITY_MAX = 70;

export function getCapsule(capsuleId) {
  const capsule = CAPSULES[capsuleId];
  if (!capsule) {
    throw new Error(`Unknown capsule type: ${capsuleId}`);
  }
  return capsule;
}

export function getDrawCost(capsuleId, count) {
  const capsule = getCapsule(capsuleId);
  return count === 10 ? capsule.tenCost : capsule.singleCost;
}

// 순수 추첨: 머니/상태를 건드리지 않고 뽑힌 아이템 배열만 만든다.
// (PHASE 2: 온라인 결제는 Firebase 트랜잭션이 담당하므로 추첨과 결제를 분리)
export function rollItems(capsuleId, count) {
  const capsule = getCapsule(capsuleId);
  const drawCount = count === 10 ? 10 : 1;
  const items = [];
  for (let index = 0; index < drawCount; index += 1) {
    items.push(pickItemByGrade(rollGrade(capsule.rates)));
  }
  if (drawCount === 10 && !items.some((item) => RARE_OR_ABOVE.has(item.grade))) {
    items[items.length - 1] = pickItemByGrade(rollGrade(capsule.rates, "Rare"));
  }
  return { capsule, drawCount, items };
}

// 천장 적용 추첨: pityStart(직전까지 Legendary+ 없이 뽑은 횟수)부터 누적.
// pity 가 PITY_MAX 에 도달하는 뽑기는 Legendary 이상을 강제하고, Legendary+ 가 나오면 0 으로 리셋.
// 반환에 next pity 를 포함해 호출측이 저장한다.
export function rollItemsWithPity(capsuleId, count, pityStart) {
  const capsule = getCapsule(capsuleId);
  const drawCount = count === 10 ? 10 : 1;
  let pity = Math.max(0, Number(pityStart) || 0);
  const items = [];
  for (let index = 0; index < drawCount; index += 1) {
    pity += 1;
    const item = pity >= PITY_MAX
      ? pickItemByGrade(rollGrade(capsule.rates, "Legendary")) // 천장 도달 → Legendary 이상 보장
      : pickItemByGrade(rollGrade(capsule.rates));
    if (LEGENDARY_OR_ABOVE.has(item.grade)) pity = 0; // 보상 획득 시 천장 리셋
    items.push(item);
  }
  // 10연차 Rare 이상 1개 보장(기존 규칙 유지)
  if (drawCount === 10 && !items.some((it) => RARE_OR_ABOVE.has(it.grade))) {
    items[items.length - 1] = pickItemByGrade(rollGrade(capsule.rates, "Rare"));
  }
  return { capsule, drawCount, items, pity };
}

// 추첨 결과를 state(인벤토리/컬렉션/히스토리/카운터)에 반영한다. 머니는 건드리지 않는다.
export function recordDraw(state, capsuleId, items) {
  const capsule = getCapsule(capsuleId);
  const drawCount = items.length;
  state.drawCountToday += drawCount;
  state.totalDraws = (state.totalDraws || 0) + drawCount;

  const batchCounts = {};
  const results = items.map((item) => {
    const countBefore = (state.inventory[item.id] || 0) + (batchCounts[item.id] || 0);
    const result = {
      capsuleId: capsule.id,
      item,
      isNew: countBefore === 0,
      isDuplicate: countBefore > 0,
      dustGained: 0
    };
    batchCounts[item.id] = (batchCounts[item.id] || 0) + 1;
    return result;
  });

  for (const result of results) {
    state.collection[result.item.id] = true;
    state.inventory[result.item.id] = (state.inventory[result.item.id] || 0) + 1;
  }

  state.history = [
    ...results.map((result) => ({
      id: createId(),
      itemId: result.item.id,
      name: result.item.name,
      grade: result.item.grade,
      type: result.item.type,
      capsule: capsule.name,
      isNew: result.isNew,
      isDuplicate: result.isDuplicate,
      dustGained: 0,
      createdAt: new Date().toISOString()
    })),
    ...state.history
  ].slice(0, 100);

  return { ok: true, capsule, drawCount, results };
}

// 로컬(오프라인) 호환용: 자체 money 로 결제 + 추첨 + 반영을 한 번에.
export function drawCapsule(state, capsuleId, count) {
  const { drawCount, items } = rollItems(capsuleId, count);
  const cost = getDrawCost(capsuleId, drawCount);
  if (state.money < cost) {
    return { ok: false, reason: "NOT_ENOUGH_MONEY", required: cost, current: state.money };
  }
  state.money -= cost;
  const result = recordDraw(state, capsuleId, items);
  return { ...result, cost };
}

export function getCollectionStats(state) {
  const ownedCount = collections.filter((item) => state.collection[item.id]).length;
  return {
    ownedCount,
    totalCount: collections.length,
    completionRate: collections.length === 0 ? 0 : Math.round((ownedCount / collections.length) * 100)
  };
}

export function getRateRows(capsuleId) {
  const capsule = getCapsule(capsuleId);
  return GRADE_ORDER.map((grade) => ({
    grade,
    rate: capsule.rates[grade]
  }));
}

function rollGrade(rates, minimumGrade = "Common") {
  const minimumIndex = GRADE_ORDER.indexOf(minimumGrade);
  const availableGrades = GRADE_ORDER.filter((grade, index) => index >= minimumIndex);
  const total = availableGrades.reduce((sum, grade) => sum + rates[grade], 0);
  let cursor = Math.random() * total;

  for (const grade of availableGrades) {
    cursor -= rates[grade];
    if (cursor <= 0) {
      return grade;
    }
  }

  return availableGrades[availableGrades.length - 1];
}

function pickItemByGrade(grade) {
  const pool = collections.filter((item) => item.grade === grade);
  return pool[Math.floor(Math.random() * pool.length)];
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
