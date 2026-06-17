import { collections, GRADE_ORDER, TYPE_ORDER } from "../data/collections.js";
import { getShopItem } from "../data/shop.js";

export const DUST_BY_GRADE = {
  Common: 10,
  Rare: 40,
  Epic: 150,
  Legendary: 600,
  Mythic: 2000
};

export function getDismantleInfo(state, item) {
  const ownedCount = state.inventory[item.id] || 0;
  const dismantleableCount = Math.max(0, ownedCount - 1);
  const dustPerItem = DUST_BY_GRADE[item.grade] || 0;

  return {
    ownedCount,
    dismantleableCount,
    dustPerItem,
    maxDust: dismantleableCount * dustPerItem,
    canDismantle: dismantleableCount > 0
  };
}

export function dismantleItem(state, itemId, quantity) {
  const item = collections.find((collectionItem) => collectionItem.id === itemId);
  if (!item) {
    return { ok: false, reason: "UNKNOWN_COLLECTION" };
  }

  const info = getDismantleInfo(state, item);
  const requestedQuantity = Math.floor(Number(quantity));
  const dismantleQuantity = Math.min(info.dismantleableCount, Math.max(0, requestedQuantity));

  if (dismantleQuantity <= 0) {
    return { ok: false, reason: "NO_DUPLICATES" };
  }

  const dustGained = dismantleQuantity * info.dustPerItem;
  state.inventory[itemId] -= dismantleQuantity;
  state.dust += dustGained;
  state.totalDismantled = (state.totalDismantled || 0) + dismantleQuantity;
  state.totalDustEarned = (state.totalDustEarned || 0) + dustGained;
  state.collection[itemId] = state.inventory[itemId] > 0;

  return {
    ok: true,
    item,
    quantity: dismantleQuantity,
    dustGained
  };
}

export function getBulkDismantlePreview(state) {
  const entries = collections
    .map((item) => {
      const info = getDismantleInfo(state, item);
      return {
        item,
        quantity: info.dismantleableCount,
        dust: info.maxDust
      };
    })
    .filter((entry) => entry.quantity > 0);

  return {
    entries,
    totalKinds: entries.length,
    totalItems: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    totalDust: entries.reduce((sum, entry) => sum + entry.dust, 0)
  };
}

export function bulkDismantle(state) {
  const preview = getBulkDismantlePreview(state);
  for (const entry of preview.entries) {
    state.inventory[entry.item.id] -= entry.quantity;
    state.collection[entry.item.id] = state.inventory[entry.item.id] > 0;
  }

  state.dust += preview.totalDust;
  state.totalDismantled = (state.totalDismantled || 0) + preview.totalItems;
  state.totalDustEarned = (state.totalDustEarned || 0) + preview.totalDust;

  return {
    ok: preview.totalItems > 0,
    ...preview
  };
}

export function purchaseShopItem(state, itemId) {
  const item = getShopItem(itemId);
  if (!item) {
    return { ok: false, reason: "UNKNOWN_SHOP_ITEM" };
  }

  if (state.dust < item.price) {
    return {
      ok: false,
      reason: "NOT_ENOUGH_DUST",
      item,
      required: item.price,
      current: state.dust
    };
  }

  state.dust -= item.price;
  state.shopInventory[item.id] = (state.shopInventory[item.id] || 0) + item.quantity;
  state.shopPurchases = [
    {
      id: createId(),
      itemId: item.id,
      name: item.name,
      type: item.type,
      quantity: item.quantity,
      cost: item.price,
      createdAt: new Date().toISOString()
    },
    ...state.shopPurchases
  ].slice(0, 80);

  return {
    ok: true,
    item
  };
}

export function getAdvancedStats(state) {
  const gradeOwnedCounts = Object.fromEntries(GRADE_ORDER.map((grade) => [grade, 0]));
  const typeOwnedCounts = Object.fromEntries(TYPE_ORDER.map((type) => [type, 0]));

  for (const item of collections) {
    if (state.collection[item.id]) {
      gradeOwnedCounts[item.grade] += 1;
      typeOwnedCounts[item.type] += 1;
    }
  }

  const recentHighestGrade = findRecentHighestGrade(state.history);
  const bulkPreview = getBulkDismantlePreview(state);

  return {
    gradeOwnedCounts,
    typeOwnedCounts,
    recentHighestGrade,
    duplicateQuantity: bulkPreview.totalItems,
    dismantleableDust: bulkPreview.totalDust,
    totalDismantled: state.totalDismantled || 0,
    totalDustEarned: state.totalDustEarned || 0
  };
}

function findRecentHighestGrade(history) {
  const recentEntries = Array.isArray(history) ? history.slice(0, 10) : [];
  let highest = null;
  let highestIndex = -1;

  for (const entry of recentEntries) {
    const gradeIndex = GRADE_ORDER.indexOf(entry.grade);
    if (gradeIndex > highestIndex) {
      highest = entry.grade;
      highestIndex = gradeIndex;
    }
  }

  return highest || "None";
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
