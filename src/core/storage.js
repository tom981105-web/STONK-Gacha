export const STORAGE_KEY = "stonkGachaState";

const DEFAULT_MONEY = 100000000;

export function getTodayKey() {
  return new Date().toLocaleDateString("en-CA");
}

export function createDefaultState() {
  return {
    money: DEFAULT_MONEY,
    dust: 0,
    collection: {},
    inventory: {},
    drawCountToday: 0,
    totalDraws: 0,
    lastVisitDate: getTodayKey(),
    history: [],
    shopInventory: {},
    shopPurchases: [],
    totalDismantled: 0,
    totalDustEarned: 0,
    selectedFrame: null,
    selectedTheme: null,
    selectedSkin: null,
    selectedEffect: null
  };
}

export const localStorageAdapter = {
  read(key) {
    return window.localStorage.getItem(key);
  },
  write(key, value) {
    window.localStorage.setItem(key, value);
  },
  remove(key) {
    window.localStorage.removeItem(key);
  }
};

export function normalizeState(rawState) {
  const base = createDefaultState();
  const incoming = rawState && typeof rawState === "object" ? rawState : {};
  const state = {
    ...base,
    ...incoming
  };

  state.money = toNumber(state.money, base.money);
  state.dust = toNumber(state.dust, base.dust);
  state.collection = isPlainObject(state.collection) ? { ...state.collection } : {};
  state.inventory = isPlainObject(state.inventory) ? { ...state.inventory } : {};
  state.history = Array.isArray(state.history) ? state.history : [];
  state.shopInventory = isPlainObject(state.shopInventory) ? { ...state.shopInventory } : {};
  state.shopPurchases = Array.isArray(state.shopPurchases) ? state.shopPurchases : [];
  state.totalDismantled = toNumber(state.totalDismantled, 0);
  state.totalDustEarned = toNumber(state.totalDustEarned, 0);
  state.totalDraws = toNumber(state.totalDraws, state.history.length);
  state.selectedFrame = normalizeSelected(state.selectedFrame);
  state.selectedTheme = normalizeSelected(state.selectedTheme);
  state.selectedSkin = normalizeSelected(state.selectedSkin);
  state.selectedEffect = normalizeSelected(state.selectedEffect);

  for (const [itemId, count] of Object.entries(state.inventory)) {
    const normalizedCount = Math.max(0, Math.floor(toNumber(count, 0)));
    if (normalizedCount > 0) {
      state.inventory[itemId] = normalizedCount;
      state.collection[itemId] = true;
    } else {
      delete state.inventory[itemId];
    }
  }

  for (const [itemId, owned] of Object.entries(state.collection)) {
    if (owned && !state.inventory[itemId]) {
      state.inventory[itemId] = 1;
    }
    if (!owned && !state.inventory[itemId]) {
      delete state.collection[itemId];
    }
  }

  for (const [itemId, count] of Object.entries(state.shopInventory)) {
    const normalizedCount = Math.max(0, Math.floor(toNumber(count, 0)));
    if (normalizedCount > 0) {
      state.shopInventory[itemId] = normalizedCount;
    } else {
      delete state.shopInventory[itemId];
    }
  }

  if (state.lastVisitDate !== getTodayKey()) {
    state.drawCountToday = 0;
    state.lastVisitDate = getTodayKey();
  } else {
    state.drawCountToday = toNumber(state.drawCountToday, 0);
  }

  return state;
}

export function loadState(adapter = localStorageAdapter) {
  try {
    const stored = adapter.read(STORAGE_KEY);
    if (!stored) {
      const initialState = createDefaultState();
      saveState(initialState, adapter);
      return initialState;
    }

    const state = normalizeState(JSON.parse(stored));
    saveState(state, adapter);
    return state;
  } catch (error) {
    console.warn("Failed to load STONK Gacha state. A fresh state was created.", error);
    const initialState = createDefaultState();
    saveState(initialState, adapter);
    return initialState;
  }
}

export function saveState(state, adapter = localStorageAdapter) {
  adapter.write(STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

export function resetState(adapter = localStorageAdapter) {
  adapter.remove(STORAGE_KEY);
  const initialState = createDefaultState();
  saveState(initialState, adapter);
  return initialState;
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeSelected(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
