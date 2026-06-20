import { collections, GRADE_ORDER, TYPE_ORDER } from "../data/collections.js";
import { shopItems } from "../data/shop.js";
import { CAPSULES, SERIES, DEFAULT_SERIES, rollItems, rollItemsWithPity, recordDraw, drawCapsule, getCollectionStats, getRateRows, getDrawCost, PITY_MAX } from "../core/gacha.js";
import { loadState, normalizeState, resetState, saveState, getTodayKey } from "../core/storage.js";
import {
  bulkDismantle,
  dismantleItem,
  getAdvancedStats,
  getBulkDismantlePreview,
  getDismantleInfo,
  purchaseShopItem,
  getAllFusionInfo,
  fuseGrade,
  FUSION_COST
} from "../core/economy.js";
import { getAchievements, getAchievementSummary, claimAchievement } from "../core/achievements.js";
import { showModal, closeModal } from "./modal.js";
import { showToast } from "./toast.js";
import * as remote from "../core/remote.js";
import { sfx, isMuted, toggleMuted } from "../core/sound.js";
import { isLocalDev, showHomeGate } from "../homeGate.js";

const filters = {
  grade: "All",
  type: "All",
  ownedOnly: false,
  query: ""
};

// 형제 폴더 상대경로(같은 GitHub Pages origin). 이동 시 roomCode(?room=) 유지.
const ROUTES = {
  home: "../STONK-Home/index.html",
  battle: "../STONK-Battle/index.html",
  arcade: "../STONK-Arcade/index.html",
  board: "../STONK-Board/index.html",
  wiki: "../STONK-Wiki/index.html",
  admin: "../STONK-Admin/market-admin.html"
};
const ADMIN_UID = "yaV8N60yIiUggaWNpNF2VhkCwxb2"; // 이 계정에게만 관리자 페이지 버튼 노출

const reduceMotion = (() => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
})();

let appRoot;
let state;
let isDrawing = false;
let activeCapsuleId = null;
let devClickCount = 0;
let lastDrawRequest = { capsuleId: DEFAULT_SERIES, count: 1 };

// PHASE 2 원격 상태
let roomCode = "";
let user = null;
let player = null; // { uid, nickname, cash }
let connection = "offline"; // offline | connecting | online | error
let roomLogs = [];

function online() {
  return Boolean(remote.isConfigured && user && roomCode && connection === "online");
}

export function initApp(root) {
  appRoot = root;
  state = loadState(); // 로컬 캐시로 즉시 1차 페인트
  roomCode = remote.getUrlRoomCode() || remote.getStoredRoomCode() || "MAIN"; // 단일 방 운영: 항상 고정 방
  if (!remote.isConfigured) {
    connection = "offline";
    renderApp();
    return;
  }
  // PHASE 3: 방 코드 없이 직접 접속하면 STONK Home 으로 안내(배포). 개발 환경은 자체 방 입력 게이트 유지.
  if (!roomCode && !isLocalDev()) {
    showHomeGate({ message: "STONK Home에서 로그인 후 방을 선택해 Gacha Shop에 입장해 주세요." });
    return;
  }
  if (roomCode) {
    boot(roomCode);
  } else {
    connection = "offline";
    renderApp();
  }
}

async function boot(code) {
  try {
    connection = "connecting";
    roomCode = remote.normalizeRoomCode(code);
    remote.saveRoomCode(roomCode);
    renderApp();

    // PHASE 3: 기존 세션(Home/Battle 로그인) 우선. 세션이 없으면 Home 으로 안내(배포),
    // 개발 환경에서만 익명 로그인 허용(로컬 테스트용).
    user = await remote.getCurrentUserOnce();
    if (!user) {
      if (isLocalDev()) {
        user = await remote.ensureUser();
      } else {
        showHomeGate({ roomCode, message: "STONK Home에서 로그인 후 Gacha Shop에 입장해 주세요." });
        return;
      }
    }
    player = await remote.loadGachaPlayer(roomCode, user.uid);
    mergeRemoteIntoState(player);
    roomLogs = await remote.loadGachaLogs(roomCode, 20);
    connection = "online";
    saveState(state);
  } catch (error) {
    console.error("[gacha] boot 실패:", error);
    connection = "error";
    showToast(error.message || "입장 중 오류가 발생했습니다.", "danger");
  } finally {
    renderApp();
  }
}

// Firebase 플레이어 데이터를 로컬 state 모델에 덮어쓴다(인벤토리/더스트/스탯/상점).
function mergeRemoteIntoState(p) {
  const gs = p.gachaStats || {};
  state.money = p.cash; // 실제 재화 = 공통 cash
  state.dust = p.dust;
  state.inventory = { ...p.gachaInventory };
  state.shopInventory = { ...p.gachaShop };
  state.totalDraws = Number(gs.totalDraws) || 0;
  state.drawCountToday = Number(gs.drawCountToday) || 0;
  state.lastVisitDate = gs.lastVisitDate || getTodayKey();
  state.totalDismantled = Number(gs.totalDismantled) || 0;
  state.totalDustEarned = Number(gs.totalDustEarned) || 0;
  state.freeClaimedDate = gs.freeClaimedDate || null;
  state.pity = Math.max(0, Number(gs.pity) || 0);
  state.totalFused = Number(gs.totalFused) || 0;
  state.achievementsClaimed = Array.isArray(gs.achievementsClaimed) ? gs.achievementsClaimed : [];
  state.collection = {};
  state = normalizeState(state); // 인벤토리→컬렉션 재구성 + 일일 카운터 리셋
}

function buildGachaStats() {
  return {
    totalDraws: state.totalDraws || 0,
    drawCountToday: state.drawCountToday || 0,
    lastVisitDate: state.lastVisitDate || getTodayKey(),
    totalDismantled: state.totalDismantled || 0,
    totalDustEarned: state.totalDustEarned || 0,
    freeClaimedDate: state.freeClaimedDate || null,
    pity: Math.max(0, Number(state.pity) || 0),
    totalFused: Number(state.totalFused) || 0,
    achievementsClaimed: Array.isArray(state.achievementsClaimed) ? state.achievementsClaimed : [],
    updatedAt: Date.now()
  };
}

// 결과 확정 시점 저장: 온라인이면 Firebase 부분 update 1회 + 로컬 캐시, 아니면 로컬만.
async function commit() {
  saveState(state); // 로컬 캐시(즉시 복원용)
  if (!online()) return;
  try {
    await remote.savePlayerGacha(roomCode, user.uid, {
      gachaInventory: state.inventory,
      dust: state.dust,
      gachaStats: buildGachaStats(),
      gachaShop: state.shopInventory
    });
    player.cash = state.money;
  } catch (e) {
    console.error("[gacha] 저장 실패:", e);
    showToast("저장에 실패했습니다. 네트워크를 확인하세요.", "danger");
  }
}

function freePullAvailable() {
  return online() && state.freeClaimedDate !== getTodayKey();
}

function renderApp() {
  state = normalizeState(state);
  if (remote.isConfigured && !roomCode) {
    renderGate();
    return;
  }
  const collectionStats = getCollectionStats(state);
  const advancedStats = getAdvancedStats(state);

  appRoot.innerHTML = `
    <div class="app-shell ${isDrawing ? "is-drawing" : ""}">
      ${renderStatusBar(collectionStats)}
      ${renderBanner()}
      <main class="main-layout">
        <section class="machine-zone" aria-label="Gacha capsules">
          <div class="brand-block">
            <p class="eyebrow">STONK 캡슐 교환소</p>
            <h1>STONK Gacha Shop</h1>
            <p class="brand-copy">시리즈별 캡슐을 돌려 STONK 세계관의 배경화면을 수집하세요. 첫 시리즈는 <b>주식시장 배경화면</b>입니다.</p>
          </div>
          <div class="capsule-grid">
            ${SERIES.map((s) => renderCapsule(s)).join("")}
          </div>
        </section>

        <aside class="side-zone" aria-label="Activity and statistics">
          ${renderStatsPanel(collectionStats, advancedStats)}
          ${renderAchievements()}
          ${renderHistory()}
          ${renderRoomFeed()}
        </aside>

        <section class="fusion-zone" aria-label="Fusion lab">
          ${renderFusion()}
        </section>

        <section class="shop-zone" aria-label="Dust exchange">
          ${renderShop()}
        </section>

        <section class="collection-zone" aria-label="Collection archive">
          ${renderCollectionHeader(collectionStats, advancedStats)}
          ${renderCollectionGrid()}
        </section>
      </main>
      <footer class="site-footer">
        <button class="version-trigger" type="button" data-dev-trigger>STONK Gacha v0.3.0 Phase 2</button>
      </footer>
    </div>
  `;

  bindEvents();
}

function renderGate() {
  appRoot.innerHTML = `
    <div class="app-shell gate-shell">
      <section class="gate-card">
        <p class="eyebrow">STONK Capsule Exchange</p>
        <h1>STONK Gacha Shop</h1>
        <p class="brand-copy">Battle에서 쓰던 <b>방 코드</b>로 입장하면 같은 <b>보유 현금</b>으로 캡슐을 뽑습니다.</p>
        <form id="roomForm" class="gate-form">
          <input id="roomInput" value="${escapeHtml(roomCode)}" placeholder="예: ABC123" autocomplete="off" maxlength="12" />
          <button class="primary-button strong" type="submit">Gacha Shop 입장</button>
        </form>
        <nav class="gate-nav">
          <a href="${ROUTES.home}">홈</a>
          <a href="${ROUTES.battle}">주식시장</a>
          <a href="${ROUTES.arcade}">아케이드</a>
        </nav>
        ${connection === "error" ? `<p class="gate-error">연결 오류가 발생했습니다. 잠시 후 다시 시도하세요.</p>` : ""}
      </section>
    </div>
  `;
  appRoot.querySelector("#roomForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = remote.normalizeRoomCode(appRoot.querySelector("#roomInput")?.value);
    if (!code) { showToast("방 코드를 입력하세요.", "danger"); return; }
    sfx.click();
    boot(code);
  });
}

function withRoom(url) {
  return roomCode ? `${url}?room=${encodeURIComponent(roomCode)}` : url;
}

function connectionChip() {
  const map = {
    online: ["connected", "연결됨"],
    connecting: ["pending", "입장 중..."],
    error: ["error", "연결 오류"],
    offline: ["pending", remote.isConfigured ? "오프라인" : "로컬 모드"]
  };
  const [cls, label] = map[connection] || map.offline;
  return `<span class="conn-chip conn-${cls}">${label}</span>`;
}

function renderStatusBar(stats) {
  const muted = isMuted();
  return `
    <header class="status-bar">
      <nav class="nav-buttons" aria-label="STONK network">
        <a class="nav-link" href="${withRoom(ROUTES.home)}">홈</a>
        <a class="nav-link" href="${withRoom(ROUTES.battle)}">주식시장</a>
        <a class="nav-link" href="${withRoom(ROUTES.board)}">주식소식</a>
        <a class="nav-link" href="${withRoom(ROUTES.wiki)}">주식정보</a>
        <a class="nav-link" href="${withRoom(ROUTES.arcade)}">아케이드</a>
        ${user && user.uid === ADMIN_UID ? `<a class="nav-link" href="${withRoom(ROUTES.admin)}">관리자 페이지</a>` : ""}
      </nav>
      <div class="status-cluster">
        ${roomCode ? `<div class="status-metric metric-room"><span>방</span><strong>${escapeHtml(roomCode)}</strong></div>` : ""}
        ${connectionChip()}
        ${renderMetric("보유금", `${formatNumber(state.money)}`, "money")}
        ${renderMetric("더스트", formatNumber(state.dust), "dust")}
        ${renderMetric("도감", `${stats.ownedCount}/${stats.totalCount}`, "collection")}
        ${renderMetric("오늘", `${state.drawCountToday}`, "draws")}
        <button class="sound-toggle ${muted ? "is-muted" : ""}" type="button" data-sound-toggle aria-label="소리 켜기/끄기" title="소리 ${muted ? "꺼짐" : "켜짐"}">${muted ? "🔇" : "🔊"}</button>
      </div>
    </header>
  `;
}

function renderMetric(label, value, tone) {
  return `
    <div class="status-metric metric-${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderBanner() {
  const free = freePullAvailable();
  const pity = Math.max(0, Number(state.pity) || 0);
  const remain = Math.max(0, PITY_MAX - pity);
  const pct = Math.min(100, Math.round((pity / PITY_MAX) * 100));
  const close = remain <= 10;
  return `
    <section class="pickup-banner" aria-label="Season banner">
      <div class="pickup-glow" aria-hidden="true"></div>
      <div class="pickup-copy">
        <span class="pickup-tag">시즌 1 · 네온 마켓</span>
        <h2>오늘의 픽업 — Mythic 확률 UP 연출 캡슐</h2>
        <p>10연차는 Rare 이상 1개 확정. Legendary·Mythic 등장 시 특별 연출이 재생됩니다.</p>
        <div class="pity-meter ${close ? "pity-close" : ""}" title="천장: ${PITY_MAX}회 안에 Legendary 이상 보장">
          <div class="pity-label">천장까지 <strong>${remain}</strong>회 · Legendary 이상 보장</div>
          <div class="pity-bar"><span style="width:${pct}%"></span></div>
        </div>
      </div>
      <div class="pickup-actions">
        <button class="free-pull ${free ? "" : "claimed"}" type="button" data-free-pull ${free ? "" : "disabled"}>
          ${free ? "🎁 오늘의 무료 1뽑" : "오늘 무료뽑기 완료"}
        </button>
      </div>
    </section>
  `;
}

function renderCapsule(capsule) {
  const isActive = activeCapsuleId === capsule.id;
  const drawingThis = isDrawing && isActive;
  return `
    <article class="capsule-card capsule-${capsule.tone} ${isActive ? "capsule-active" : ""} ${drawingThis ? "is-cranking" : ""}">
      <div class="capsule-visual" aria-hidden="true">
        <div class="capsule-machine">
          <div class="machine-dome"><div class="capsule-ball ball-${capsule.tone}"><span>${capsule.emoji || "🎁"}</span></div></div>
          <div class="machine-body"><div class="machine-slot"></div></div>
        </div>
      </div>
      <div class="capsule-content">
        <p class="capsule-label">${capsule.subtitle || "STONK 시리즈 캡슐"}</p>
        <h2>${capsule.name}</h2>
        <div class="price-lines">
          <span>1회 · ${formatNumber(capsule.singleCost)}</span>
          <span>10회 · ${formatNumber(capsule.tenCost)}</span>
        </div>
        <div class="capsule-actions">
          <button class="primary-button" type="button" data-draw="${capsule.id}" data-count="1" ${isDrawing ? "disabled" : ""}>1회 뽑기</button>
          <button class="primary-button strong" type="button" data-draw="${capsule.id}" data-count="10" ${isDrawing ? "disabled" : ""}>10회 뽑기</button>
          <button class="ghost-button" type="button" data-rates="${capsule.id}" ${isDrawing ? "disabled" : ""}>확률</button>
        </div>
      </div>
    </article>
  `;
}

function renderStatsPanel(collectionStats, advancedStats) {
  const gradeRows = GRADE_ORDER.map(
    (grade) => `<span class="grade-chip grade-${grade.toLowerCase()}">${grade} ${advancedStats.gradeOwnedCounts[grade]}</span>`
  ).join("");
  const typeRows = TYPE_ORDER.map(
    (type) => `<span class="type-chip">${typeKo(type)} ${advancedStats.typeOwnedCounts[type]}</span>`
  ).join("");

  return `
    <section class="stats-panel">
      <div class="section-heading compact-heading">
        <div>
          <p class="eyebrow">보관함 통계</p>
          <h2>도감 통계</h2>
        </div>
      </div>
      <div class="stats-grid">
        ${renderMiniStat("완성도", `${collectionStats.completionRate}%`)}
        ${renderMiniStat("누적 뽑기", formatNumber(state.totalDraws || 0))}
        ${renderMiniStat("오늘 뽑기", formatNumber(state.drawCountToday))}
        ${renderMiniStat("최근 최고", advancedStats.recentHighestGrade)}
        ${renderMiniStat("중복", formatNumber(advancedStats.duplicateQuantity))}
        ${renderMiniStat("더스트 가능", formatNumber(advancedStats.dismantleableDust))}
      </div>
      <div class="stat-chip-row">${gradeRows}</div>
      <div class="stat-chip-row">${typeRows}</div>
      <button class="ghost-button full-button" type="button" data-bulk-dismantle ${advancedStats.duplicateQuantity ? "" : "disabled"}>
        중복 일괄 분해 · +${formatNumber(advancedStats.dismantleableDust)} 더스트
      </button>
    </section>
  `;
}

function renderMiniStat(label, value) {
  return `
    <div class="mini-stat">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderHistory() {
  const historyRows = state.history.slice(0, 8);

  return `
    <section class="activity-zone">
      <div class="section-heading compact-heading">
        <div>
          <p class="eyebrow">내 최근 획득</p>
          <h2>최근 획득</h2>
        </div>
      </div>
      <div class="history-list">
        ${
          historyRows.length
            ? historyRows
                .map(
                  (entry) => `
                    <button class="history-row grade-${entry.grade.toLowerCase()}" type="button" data-collection-id="${entry.itemId}">
                      <div>
                        <strong>${entry.name}</strong>
                        <span>${entry.capsule} / ${entry.type}</span>
                      </div>
                      <em>${entry.isNew ? "신규" : "중복"}</em>
                    </button>
                  `
                )
                .join("")
            : `<div class="empty-history">아직 뽑기 기록이 없습니다.</div>`
        }
      </div>
    </section>
  `;
}

function renderRoomFeed() {
  if (!online() && !roomLogs.length) return "";
  const rows = roomLogs.slice(0, 8);
  return `
    <section class="activity-zone room-feed">
      <div class="section-heading compact-heading">
        <div>
          <p class="eyebrow">같은 방 획득 피드</p>
          <h2>방 피드</h2>
        </div>
      </div>
      <div class="history-list">
        ${
          rows.length
            ? rows.map((e) => `
                <div class="history-row grade-${String(e.grade || "common").toLowerCase()}">
                  <div>
                    <strong>${escapeHtml(e.name || "-")}</strong>
                    <span>${escapeHtml(e.nickname || "?")} · ${escapeHtml(e.grade || "")}</span>
                  </div>
                  <em>${escapeHtml(e.capsule || "")}</em>
                </div>`).join("")
            : `<div class="empty-history">방의 다른 유저 획득이 여기 표시됩니다.</div>`
        }
      </div>
    </section>
  `;
}

function renderFusion() {
  const rows = getAllFusionInfo(state);
  return `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Alchemy desk</p>
        <h2>합성소</h2>
      </div>
      <div class="archive-summary">
        <strong>${FUSION_COST} : 1</strong>
        <span>여분 → 상위 등급</span>
      </div>
    </div>
    <div class="fusion-grid">
      ${rows.map(renderFusionRow).join("")}
    </div>
    <p class="fusion-note">같은 등급 <b>여분 ${FUSION_COST}개</b>를 소모해 한 단계 위 등급 1개를 무작위로 연성합니다. 각 컬렉션의 1개는 항상 보존됩니다.</p>
  `;
}

function renderFusionRow(info) {
  const gl = info.grade.toLowerCase();
  const nl = (info.nextGrade || "").toLowerCase();
  return `
    <div class="fusion-row grade-${gl}">
      <div class="fusion-from grade-${gl}">
        <span class="grade-pill">${info.grade}</span>
        <em>여분 ${info.spareCopies}</em>
      </div>
      <div class="fusion-arrow">→</div>
      <div class="fusion-to grade-${nl}">
        <span class="grade-pill">${info.nextGrade || "-"}</span>
      </div>
      <button class="primary-button fusion-btn" type="button" data-fuse="${info.grade}" ${info.canFuse ? "" : "disabled"}>
        ${info.canFuse ? `합성 (${info.possibleFusions})` : `여분 ${info.cost}개 필요`}
      </button>
    </div>`;
}

function renderAchievements() {
  const list = getAchievements(state);
  const summary = getAchievementSummary(state);
  return `
    <section class="achievements-block">
      <div class="section-heading compact-heading">
        <div>
          <p class="eyebrow">Milestones</p>
          <h2>도전과제</h2>
        </div>
        <div class="ach-progress">${summary.done}<span>/${summary.total}</span></div>
      </div>
      <div class="ach-list">
        ${list.map(renderAchievementRow).join("")}
      </div>
    </section>`;
}

function renderAchievementRow(a) {
  const pct = Math.min(100, Math.round((a.progress / a.goal) * 100));
  return `
    <div class="ach-row ${a.done ? "is-done" : ""} ${a.claimed ? "is-claimed" : ""} ${a.claimable ? "is-claimable" : ""}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-body">
        <div class="ach-top"><strong>${a.name}</strong><span>${formatNumber(a.value)}/${formatNumber(a.goal)}</span></div>
        <div class="ach-desc">${a.desc}</div>
        <div class="ach-bar"><span style="width:${pct}%"></span></div>
      </div>
      <div class="ach-action">
        ${a.claimable
          ? `<button class="primary-button ach-claim" type="button" data-claim-achievement="${a.id}">+${formatNumber(a.reward)}</button>`
          : a.claimed
            ? `<span class="ach-claimed">✓ 수령</span>`
            : `<span class="ach-reward">${formatNumber(a.reward)}<em>Dust</em></span>`}
      </div>
    </div>`;
}

function renderShop() {
  return `
    <div class="section-heading">
      <div>
        <p class="eyebrow">더스트 교환 데스크</p>
        <h2>더스트 교환소</h2>
      </div>
      <div class="archive-summary">
        <strong>${formatNumber(state.dust)}</strong>
        <span>더스트 보유</span>
      </div>
    </div>
    <div class="shop-grid">
      ${shopItems.map((item) => renderShopItem(item)).join("")}
    </div>
  `;
}

function renderShopItem(item) {
  const owned = state.shopInventory[item.id] || 0;
  const canBuy = state.dust >= item.price;

  return `
    <article class="shop-card ${canBuy ? "" : "is-locked-shop"}">
      <div class="shop-topline">
        <span>${typeKo(item.type)}</span>
        <strong>보유 ${formatNumber(owned)}</strong>
      </div>
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <div class="shop-footer">
        <span>${formatNumber(item.price)} 더스트</span>
        <button class="primary-button shop-buy" type="button" data-shop-buy="${item.id}" ${canBuy ? "" : "disabled"}>
          ${canBuy ? "교환" : "더스트 부족"}
        </button>
      </div>
    </article>
  `;
}

function renderCollectionHeader(stats, advancedStats) {
  return `
    <div class="section-heading collection-heading">
      <div>
        <p class="eyebrow">컬렉션 아카이브</p>
        <h2>컬렉션 도감</h2>
      </div>
      <div class="archive-summary">
        <strong>${stats.ownedCount}</strong>
        <span>/ ${stats.totalCount} 보유</span>
      </div>
    </div>
    <div class="filter-bar">
      <label>
        <span>등급</span>
        <select data-filter-grade>
          ${["All", ...GRADE_ORDER].map((grade) => `<option value="${grade}" ${filters.grade === grade ? "selected" : ""}>${grade === "All" ? "전체" : grade}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>종류</span>
        <select data-filter-type>
          ${["All", ...TYPE_ORDER].map((type) => `<option value="${type}" ${filters.type === type ? "selected" : ""}>${typeKo(type)}</option>`).join("")}
        </select>
      </label>
      <label class="search-filter">
        <span>검색</span>
        <input type="search" data-filter-query value="${filters.query}" placeholder="이름 또는 효과" />
      </label>
      <label class="toggle-filter">
        <input type="checkbox" data-filter-owned ${filters.ownedOnly ? "checked" : ""} />
        <span>보유만</span>
      </label>
      <button class="ghost-button" type="button" data-reset-filters>초기화</button>
      <div class="filter-note">중복으로 ${formatNumber(advancedStats.dismantleableDust)} 더스트 확보 가능</div>
    </div>
  `;
}

function renderCollectionGrid() {
  const query = filters.query.trim().toLowerCase();
  const visibleItems = collections.filter((item) => {
    const isOwned = Boolean(state.collection[item.id]);
    const matchesQuery =
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.effectText.toLowerCase().includes(query);

    return (
      matchesQuery &&
      (filters.grade === "All" || item.grade === filters.grade) &&
      (filters.type === "All" || item.type === filters.type) &&
      (!filters.ownedOnly || isOwned)
    );
  });

  if (!visibleItems.length) {
    return `<div class="empty-collection">현재 필터에 맞는 컬렉션이 없습니다.</div>`;
  }

  return `
    <div class="collection-grid">
      ${visibleItems.map((item) => renderCollectionCard(item)).join("")}
    </div>
  `;
}

function renderCollectionCard(item) {
  const owned = Boolean(state.collection[item.id]);
  const count = state.inventory[item.id] || 0;
  const duplicateCount = Math.max(0, count - 1);

  return `
    <article class="collection-card ${owned ? "is-owned" : "is-locked"} grade-${item.grade.toLowerCase()}" data-collection-id="${item.id}" tabindex="0" role="button" aria-label="${item.name}">
      <div class="card-topline">
        <span class="grade-pill">${item.grade}</span>
        <span class="type-pill">${typeKo(item.type)}</span>
      </div>
      <div class="item-icon" aria-hidden="true">${owned ? item.icon : "🔒"}</div>
      <h3>${owned ? item.name : "잠긴 컬렉션"}</h3>
      <p>${owned ? item.description : "획득하면 숨겨진 시장 신호를 확인할 수 있습니다."}</p>
      <div class="card-footer">
        <span>${owned ? item.effectText : item.flavorText}</span>
        <strong>${owned ? `x${count}${duplicateCount ? ` / +${duplicateCount}` : ""}` : "미보유"}</strong>
      </div>
    </article>
  `;
}

function bindEvents() {
  appRoot.querySelectorAll("[data-draw]").forEach((button) => {
    button.addEventListener("click", () => {
      handleDraw(button.dataset.draw, Number(button.dataset.count));
    });
  });

  appRoot.querySelector("[data-free-pull]")?.addEventListener("click", () => {
    handleDraw(DEFAULT_SERIES, 1, { free: true });
  });

  appRoot.querySelector("[data-sound-toggle]")?.addEventListener("click", () => {
    const muted = toggleMuted();
    if (!muted) sfx.click();
    renderApp();
  });

  appRoot.querySelectorAll("[data-rates]").forEach((button) => {
    button.addEventListener("click", () => { sfx.click(); showRatesModal(button.dataset.rates); });
  });

  appRoot.querySelectorAll("[data-collection-id]").forEach((node) => {
    node.addEventListener("click", () => showCollectionDetail(node.dataset.collectionId));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showCollectionDetail(node.dataset.collectionId);
      }
    });
  });

  appRoot.querySelector("[data-filter-grade]")?.addEventListener("change", (event) => {
    filters.grade = event.target.value;
    renderApp();
  });

  appRoot.querySelector("[data-filter-type]")?.addEventListener("change", (event) => {
    filters.type = event.target.value;
    renderApp();
  });

  appRoot.querySelector("[data-filter-query]")?.addEventListener("input", (event) => {
    filters.query = event.target.value;
    renderApp();
  });

  appRoot.querySelector("[data-filter-owned]")?.addEventListener("change", (event) => {
    filters.ownedOnly = event.target.checked;
    renderApp();
  });

  appRoot.querySelector("[data-reset-filters]")?.addEventListener("click", () => {
    filters.grade = "All";
    filters.type = "All";
    filters.ownedOnly = false;
    filters.query = "";
    renderApp();
  });

  appRoot.querySelector("[data-bulk-dismantle]")?.addEventListener("click", showBulkDismantleConfirm);

  appRoot.querySelectorAll("[data-shop-buy]").forEach((button) => {
    button.addEventListener("click", () => handleShopPurchase(button.dataset.shopBuy));
  });

  appRoot.querySelectorAll("[data-fuse]").forEach((button) => {
    button.addEventListener("click", () => handleFuse(button.dataset.fuse));
  });

  appRoot.querySelectorAll("[data-claim-achievement]").forEach((button) => {
    button.addEventListener("click", () => handleClaimAchievement(button.dataset.claimAchievement));
  });

  appRoot.querySelector("[data-dev-trigger]")?.addEventListener("click", () => {
    devClickCount += 1;
    if (devClickCount >= 5) {
      devClickCount = 0;
      showDevMenu();
    }
  });
}

async function handleDraw(capsuleId, count, opts = {}) {
  if (isDrawing) return;
  const free = opts.free === true;

  // 오프라인(로컬 모드): 자체 money 로 기존 동작 유지
  if (!online()) {
    if (remote.isConfigured && !roomCode) { showToast("방 코드로 입장한 뒤 뽑을 수 있어요.", "info"); return; }
    return handleDrawLocal(capsuleId, count);
  }

  if (free && !freePullAvailable()) { showToast("오늘 무료뽑기는 이미 사용했어요.", "info"); return; }

  lastDrawRequest = { capsuleId, count };
  state = normalizeState(state);
  isDrawing = true;
  activeCapsuleId = capsuleId;
  renderApp();
  sfx.insert();
  sfx.crank();
  await delay(reduceMotion ? 150 : 900);

  const roll = rollItemsWithPity(capsuleId, count, state.pity);
  const { drawCount, items } = roll;
  const cost = free ? 0 : getDrawCost(capsuleId, drawCount);

  let newCash;
  try {
    newCash = cost > 0 ? await remote.spendCash(roomCode, user.uid, cost, state.money) : state.money;
  } catch (error) {
    isDrawing = false;
    activeCapsuleId = null;
    renderApp();
    sfx.fail();
    showNotEnoughMoneyModal({ required: cost, current: state.money });
    return;
  }

  const result = { ...recordDraw(state, capsuleId, items), cost };
  state.money = newCash;
  state.pity = roll.pity; // 천장 카운터 갱신
  if (free) state.freeClaimedDate = getTodayKey();
  isDrawing = false;
  activeCapsuleId = null;

  await commit();

  // 방 피드: 배치 대표(최고 등급) 1건만 기록 (쓰기 최소화)
  const best = bestResult(result.results);
  const logEntry = { uid: user.uid, nickname: player.nickname, name: best.item.name, grade: best.item.grade, type: best.item.type, capsule: result.capsule.name };
  remote.pushGachaLog(roomCode, logEntry);
  roomLogs = [{ ...logEntry, createdAt: Date.now() }, ...roomLogs].slice(0, 20);

  renderApp();
  revealThenShow(result);
}

// 오프라인 로컬 뽑기(설정 없음/방 미입장 시 호환)
async function handleDrawLocal(capsuleId, count) {
  lastDrawRequest = { capsuleId, count };
  state = normalizeState(state);
  isDrawing = true;
  activeCapsuleId = capsuleId;
  renderApp();
  sfx.insert();
  await delay(reduceMotion ? 150 : 650);

  const roll = rollItemsWithPity(capsuleId, count, state.pity);
  const cost = getDrawCost(capsuleId, roll.drawCount);
  if ((state.money || 0) < cost) {
    isDrawing = false;
    activeCapsuleId = null;
    renderApp();
    sfx.fail();
    showNotEnoughMoneyModal({ required: cost, current: state.money });
    return;
  }
  state.money -= cost;
  const result = { ...recordDraw(state, capsuleId, roll.items), cost };
  state.pity = roll.pity;
  isDrawing = false;
  activeCapsuleId = null;

  saveState(state);
  renderApp();
  revealThenShow(result);
}

function bestResult(results) {
  return results.reduce((best, cur) =>
    GRADE_ORDER.indexOf(cur.item.grade) > GRADE_ORDER.indexOf(best.item.grade) ? cur : best
  , results[0]);
}

function playGradeSfx(result) {
  const idx = Math.max(...result.results.map(({ item }) => GRADE_ORDER.indexOf(item.grade)));
  const grade = GRADE_ORDER[idx] || "Common";
  const fn = sfx[grade.toLowerCase()];
  if (fn) fn(); else sfx.pop();
  triggerRarityFx(grade);
}

// 고등급 등장 시 화면 연출(흔들림 + 파티클). prefers-reduced-motion 이면 생략.
function triggerRarityFx(grade) {
  if (reduceMotion) return;
  const tier = GRADE_ORDER.indexOf(grade);
  if (tier < GRADE_ORDER.indexOf("Epic")) return; // Epic 이상만 연출
  const shell = appRoot.querySelector(".app-shell") || document.body;
  const cls = tier >= GRADE_ORDER.indexOf("Mythic") ? "fx-mythic" : tier >= GRADE_ORDER.indexOf("Legendary") ? "fx-legendary" : "fx-epic";
  shell.classList.add("rarity-shake", cls);
  setTimeout(() => shell.classList.remove("rarity-shake", cls), 1200);

  // 파티클 버스트(Legendary 이상)
  if (tier < GRADE_ORDER.indexOf("Legendary")) return;
  const burst = document.createElement("div");
  burst.className = "rarity-particles";
  const colors = tier >= GRADE_ORDER.indexOf("Mythic") ? ["#ff4fd8", "#8d6cff", "#41e0ff"] : ["#ffcf5a", "#fff0c6", "#ffe08a"];
  for (let i = 0; i < 26; i += 1) {
    const p = document.createElement("span");
    const ang = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 220;
    p.style.setProperty("--tx", `${Math.cos(ang) * dist}px`);
    p.style.setProperty("--ty", `${Math.sin(ang) * dist}px`);
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 120}ms`;
    burst.appendChild(p);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1400);
}

function showNotEnoughMoneyModal(result) {
  showToast(`현금이 부족합니다. ${formatNumber(result.required)} 필요.`, "danger");
  showModal({
    title: "현금 부족",
    body: `
      <div class="notice-panel">
        <strong>${formatNumber(result.required)} STONK 머니 필요</strong>
        <p>현재 보유 ${formatNumber(result.current)}. Arcade에서 돈을 벌어 캡슐 머신으로 돌아오세요.</p>
      </div>
    `,
    actions: [
      {
        id: "arcade",
        label: "Arcade에서 돈 벌기",
        className: "primary-button modal-confirm",
        onClick: () => { window.location.href = withRoom(ROUTES.arcade); }
      },
      { id: "close", label: "닫기", className: "ghost-button modal-confirm", onClick: closeModal }
    ]
  });
}

function showRatesModal(capsuleId) {
  const capsule = CAPSULES[capsuleId];
  const rows = getRateRows(capsuleId)
    .map(
      (row) => `
        <tr>
          <td><span class="grade-text grade-${row.grade.toLowerCase()}">${row.grade}</span></td>
          <td>${row.rate}%</td>
        </tr>
      `
    )
    .join("");

  showModal({
    title: `${capsule.name} 확률`,
    body: `
      <table class="rate-table">
        <thead><tr><th>등급</th><th>확률</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="modal-note">10연차는 Rare 이상 1개를 확정 보장합니다.</p>
    `
  });
}

// 등급별 색/광원/라벨 — 시네마틱 개봉 연출용
const GRADE_FX = {
  common:    { color: "#c7ccd6", glow: "rgba(199,204,214,0.55)", label: "" },
  rare:      { color: "#6ea8ff", glow: "rgba(110,168,255,0.75)", label: "RARE" },
  epic:      { color: "#a06bff", glow: "rgba(160,107,255,0.82)", label: "EPIC" },
  legendary: { color: "#e8c87a", glow: "rgba(232,200,122,0.92)", label: "LEGENDARY" },
  mythic:    { color: "#ff5fa2", glow: "rgba(255,95,162,0.95)", label: "MYTHIC" }
};

let cinematicFinish = null;

// 뽑기 직후: 전체화면 시네마틱 개봉 → 끝나면 결과 모달. (모션 최소화 설정이면 바로 모달)
function revealThenShow(result) {
  if (reduceMotion) { showResultsModal(result); playGradeSfx(result); return; }
  playRevealCinematic(result);
}

function playRevealCinematic(result) {
  const tier = Math.max(...result.results.map(({ item }) => GRADE_ORDER.indexOf(item.grade)));
  const grade = (GRADE_ORDER[tier] || "Common").toLowerCase();
  const fx = GRADE_FX[grade] || GRADE_FX.common;
  const count = result.results.length;

  const ov = document.createElement("div");
  ov.className = `reveal-cine tier-${grade}`;
  ov.style.setProperty("--rc", fx.color);
  ov.style.setProperty("--rg", fx.glow);
  ov.innerHTML = `
    <div class="rc-rays"></div>
    <div class="rc-stars"></div>
    <div class="rc-core">
      <div class="rc-ring rc-ring1"></div>
      <div class="rc-ring rc-ring2"></div>
      <button class="rc-orb" type="button" aria-label="개봉">
        <span class="rc-orb-glyph">${count >= 10 ? "🔮" : "✦"}</span>
        <span class="rc-crack" aria-hidden="true"></span>
      </button>
      <div class="rc-shock"></div>
    </div>
    <div class="rc-flash"></div>
    <div class="rc-hint">탭하여 개봉!</div>
    <div class="rc-label">${fx.label ? `<b>${fx.label}</b>` : "<b class='rc-plain'>OPEN!</b>"}<small>${count >= 10 ? "10연차 결과 공개" : "결과 공개"}</small></div>
    <div class="rc-skip">탭하여 건너뛰기 ›</div>
  `;
  document.body.appendChild(ov);

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  let opened = false;
  let taps = 0;
  const needTaps = tier >= 4 ? 3 : tier >= 3 ? 2 : 1; // 고등급일수록 더 두드려야 열림(손맛↑)
  // 충전(긴장): 고등급일수록 길게 끌어 두근거림을 키운다
  const charge = tier >= 3 ? 1300 : tier >= 2 ? 950 : 700;

  sfx.insert?.();
  // 가속되는 충전음 — '드드드득' 차오르는 손맛
  (function tick(t, gap) {
    if (t > charge) return;
    at(t, () => sfx.click && sfx.click());
    tick(t + gap, Math.max(45, gap * 0.84));
  })(120, 150);

  at(40, () => ov.classList.add("is-charging"));
  // 충전 완료 → '탭하여 개봉' 대기 상태 (사용자가 직접 두드려 연다)
  at(charge, () => {
    if (opened) return;
    ov.classList.add("is-ready");
    sfx.crank && sfx.crank();
  });
  // 안 두드리면 자동 개봉 (대기 후)
  at(charge + 2600, () => burst());

  function jolt() {
    if (opened) return;
    taps += 1;
    sfx.pop && sfx.pop();
    ov.classList.remove("rc-jolt"); void ov.offsetWidth; ov.classList.add("rc-jolt"); // 재시작
    ov.querySelector(".rc-orb")?.style.setProperty("--crack", String(taps / needTaps));
    if (taps >= needTaps) burst();
  }

  function burst() {
    if (opened) return;
    opened = true;
    ov.classList.remove("is-ready");
    ov.classList.add("is-burst");
    spawnBurstParticles(ov, fx.color, tier);
    const sfn = sfx[grade]; (sfn || sfx.pop) && (sfn || sfx.pop)();
    at(280, () => ov.classList.add("is-label"));
    at(tier >= 3 ? 1750 : 1150, finish);
  }

  const finish = () => {
    if (cinematicFinish !== finish) return; // 중복 방지
    cinematicFinish = null;
    timers.forEach(clearTimeout);
    ov.classList.add("is-out");
    setTimeout(() => { ov.remove(); showResultsModal(result); }, 300);
  };
  cinematicFinish = finish;

  // 클릭 동작: 개봉 전이면 '두드려서 열기', 개봉 후(연출 중)면 '건너뛰기'
  ov.addEventListener("click", () => {
    if (!opened) {
      if (ov.classList.contains("is-ready")) jolt();
    } else {
      finish();
    }
  });
}

function spawnBurstParticles(ov, color, tier) {
  const core = ov.querySelector(".rc-core");
  if (!core) return;
  const n = tier >= 4 ? 48 : tier >= 3 ? 38 : tier >= 2 ? 26 : 16;
  const colors = tier >= 4 ? ["#ff5fa2", "#8d6cff", "#41e0ff", "#fff0c6"]
    : tier >= 3 ? ["#e8c87a", "#fff0c6", "#ffd98a"]
    : [color, "#ffffff"];
  const wrap = document.createElement("div");
  wrap.className = "rc-particles";
  for (let i = 0; i < n; i += 1) {
    const p = document.createElement("span");
    const ang = Math.random() * Math.PI * 2;
    const dist = 130 + Math.random() * 340;
    p.style.setProperty("--tx", `${Math.cos(ang) * dist}px`);
    p.style.setProperty("--ty", `${Math.sin(ang) * dist}px`);
    p.style.color = colors[i % colors.length];
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 130}ms`;
    const sz = 5 + Math.random() * 8;
    p.style.width = `${sz}px`; p.style.height = `${sz}px`;
    wrap.appendChild(p);
  }
  core.appendChild(wrap);
}

function showResultsModal(result) {
  const highestIndex = Math.max(...result.results.map(({ item }) => GRADE_ORDER.indexOf(item.grade)));
  const hasLegendary = highestIndex >= GRADE_ORDER.indexOf("Legendary");
  const hasMythic = highestIndex >= GRADE_ORDER.indexOf("Mythic");

  const resultCards = result.results
    .map(
      ({ item, isNew, isDuplicate }, index) => `
        <article class="result-card grade-${item.grade.toLowerCase()} ${GRADE_ORDER.indexOf(item.grade) >= 3 ? "special-result" : ""}" style="--delay:${index * 90}ms">
          <div class="result-badge ${isNew ? "badge-new" : "badge-dup"}">${isNew ? "신규" : "중복"}</div>
          <div class="result-flip">
            <div class="flip-back" aria-hidden="true">?</div>
            <div class="flip-front">
              <div class="item-icon">${item.icon}</div>
              <span>${item.grade} / ${item.type}</span>
              <h3>${item.name}</h3>
            </div>
          </div>
          ${isDuplicate ? `<em class="dup-note">중복 — 분해 시 Dust 획득</em>` : `<em class="new-note">신규 컬렉션 등록!</em>`}
        </article>
      `
    )
    .join("");

  showModal({
    title: `${result.capsule.name} 결과`,
    body: `
      <div class="result-stage ${hasLegendary ? "has-legendary" : ""} ${hasMythic ? "has-mythic" : ""}">
        ${hasMythic ? `<div class="rarity-flare flare-mythic">MYTHIC!</div>` : hasLegendary ? `<div class="rarity-flare flare-legendary">LEGENDARY!</div>` : ""}
        <div class="result-summary">
          <span>지출</span>
          <strong>${result.cost ? `${formatNumber(result.cost)} 머니` : "무료 뽑기 🎁"}</strong>
          <span class="result-cash">보유 ${formatNumber(state.money)}</span>
        </div>
        <div class="result-grid">${resultCards}</div>
      </div>
    `,
    actions: [
      {
        id: "archive",
        label: "도감 보기",
        className: "ghost-button modal-confirm",
        onClick: () => { closeModal(); scrollToArchive(); }
      },
      {
        id: "again",
        label: "한 번 더 뽑기",
        className: "primary-button modal-confirm",
        onClick: () => { closeModal(); handleDraw(lastDrawRequest.capsuleId, lastDrawRequest.count); }
      }
    ]
  });
}

function showCollectionDetail(itemId) {
  const item = collections.find((collectionItem) => collectionItem.id === itemId);
  if (!item) return;

  const owned = Boolean(state.collection[item.id]);
  const info = getDismantleInfo(state, item);
  const defaultQuantity = info.dismantleableCount;

  showModal({
    title: item.name,
    body: `
      <div class="detail-layout grade-${item.grade.toLowerCase()}">
        <div class="detail-icon item-icon">${owned ? item.icon : "🔒"}</div>
        <div class="detail-content">
          <div class="card-topline">
            <span class="grade-pill">${item.grade}</span>
            <span class="type-pill">${typeKo(item.type)}</span>
            <span class="state-pill">${owned ? "보유" : "미보유"}</span>
          </div>
          <p class="${owned ? "" : "locked-copy"}">${owned ? item.description : "미보유 컬렉션. 획득 전까지 상세 데이터가 일부 가려집니다."}</p>
          <blockquote class="${owned ? "" : "locked-copy"}">${item.flavorText}</blockquote>
          <div class="effect-line ${owned ? "" : "locked-copy"}">${item.effectText}</div>
          <div class="detail-stats">
            ${renderMiniStat("보유 수", formatNumber(info.ownedCount))}
            ${renderMiniStat("분해 가능", formatNumber(info.dismantleableCount))}
            ${renderMiniStat("개당 Dust", formatNumber(info.dustPerItem))}
            ${renderMiniStat("예상 Dust", formatNumber(info.maxDust))}
          </div>
          ${
            info.canDismantle
              ? `
                <label class="dismantle-control">
                  <span>분해 수량</span>
                  <input id="dismantle-qty" type="number" min="1" max="${info.dismantleableCount}" value="${defaultQuantity}" />
                </label>
                <div class="dismantle-preview">예상 Dust: <strong id="dismantle-preview">${formatNumber(info.maxDust)}</strong></div>
              `
              : `<div class="notice-panel">최소 1개는 보관됩니다. 보유 2개 이상부터 분해할 수 있어요.</div>`
          }
        </div>
      </div>
    `,
    actions: info.canDismantle
      ? [
          {
            id: "dismantle",
            label: "분해",
            className: "primary-button modal-confirm",
            onClick: async () => {
              const input = document.querySelector("#dismantle-qty");
              const result = dismantleItem(state, item.id, input?.value || defaultQuantity);
              if (!result.ok) { showToast("분해할 중복 사본이 없습니다.", "danger"); return; }
              await commit();
              renderApp();
              sfx.dust();
              showToast(`+${formatNumber(result.dustGained)} Dust 획득.`, "success");
              showCollectionDetail(item.id);
            }
          }
        ]
      : []
  });

  const input = document.querySelector("#dismantle-qty");
  const preview = document.querySelector("#dismantle-preview");
  input?.addEventListener("input", () => {
    const quantity = Math.min(info.dismantleableCount, Math.max(1, Number(input.value) || 1));
    preview.textContent = formatNumber(quantity * info.dustPerItem);
  });
}

function showBulkDismantleConfirm() {
  const preview = getBulkDismantlePreview(state);
  if (!preview.totalItems) {
    showToast("분해할 중복 사본이 없습니다.", "info");
    return;
  }

  const previewRows = preview.entries
    .slice(0, 8)
    .map((entry) => `<li>${entry.item.name} x${entry.quantity} / ${formatNumber(entry.dust)} Dust</li>`)
    .join("");

  showModal({
    title: "중복 일괄 분해",
    body: `
      <div class="notice-panel">
        <strong>${formatNumber(preview.totalDust)} Dust 예상</strong>
        <p>${formatNumber(preview.totalKinds)}종 ${formatNumber(preview.totalItems)}개의 중복 사본을 분해합니다. 각 컬렉션의 1개는 보존됩니다.</p>
      </div>
      <ul class="preview-list">${previewRows}${preview.entries.length > 8 ? `<li>...외 ${preview.entries.length - 8}종</li>` : ""}</ul>
    `,
    actions: [
      {
        id: "confirm",
        label: "분해 확정",
        className: "primary-button modal-confirm",
        onClick: async () => {
          const result = bulkDismantle(state);
          await commit();
          renderApp();
          closeModal();
          sfx.dust();
          showToast(`일괄 분해 완료: +${formatNumber(result.totalDust)} Dust.`, "success");
        }
      },
      { id: "cancel", label: "취소", className: "ghost-button modal-confirm", onClick: closeModal }
    ]
  });
}

async function handleFuse(grade) {
  if (isDrawing) return;
  state = normalizeState(state);
  const result = fuseGrade(state, grade);
  if (!result.ok) {
    showToast("합성할 여분 복제본이 부족합니다.", "info");
    return;
  }
  await commit();
  renderApp();
  const fn = sfx[String(result.item.grade).toLowerCase()];
  if (fn) fn(); else if (sfx.dust) sfx.dust();
  triggerRarityFx(result.item.grade);
  showToast(`합성 성공! ${result.item.grade} · ${result.item.name}${result.isNew ? " (NEW)" : ""}`, "success");
}

async function handleClaimAchievement(id) {
  const result = claimAchievement(state, id);
  if (!result.ok) {
    if (result.reason === "NOT_DONE") showToast("아직 조건을 달성하지 않았습니다.", "info");
    return;
  }
  await commit();
  renderApp();
  if (sfx.coin) sfx.coin();
  showToast(`도전과제 완료! ${result.name} · +${formatNumber(result.reward)} Dust`, "success");
}

function handleShopPurchase(itemId) {
  state = normalizeState(state);
  const item = shopItems.find((s) => s.id === itemId);
  if (!item) return;
  const owned = state.shopInventory[item.id] || 0;
  showModal({
    title: "교환 확인",
    body: `
      <div class="notice-panel">
        <strong>${item.name}</strong>
        <p>${item.description}</p>
        <p>${formatNumber(item.price)} Dust 를 사용합니다. (현재 보유 ${formatNumber(state.dust)} Dust · 보유 ${formatNumber(owned)})</p>
      </div>
    `,
    actions: [
      {
        id: "buy",
        label: "교환",
        className: "primary-button modal-confirm",
        onClick: async () => {
          const result = purchaseShopItem(state, itemId);
          if (!result.ok) { showToast(`Dust가 부족합니다. ${formatNumber(result.required)} 필요.`, "danger"); return; }
          await commit();
          renderApp();
          closeModal();
          sfx.coin();
          showToast(`${result.item.name} 교환 완료.`, "success");
        }
      },
      { id: "cancel", label: "취소", className: "ghost-button modal-confirm", onClick: closeModal }
    ]
  });
}

function showDevMenu() {
  showModal({
    title: "Developer Menu",
    body: `
      <div class="notice-panel">
        <strong>로컬 테스트 컨트롤</strong>
        <p>${online() ? "온라인 모드에서는 cash는 Firebase가 관리합니다. 아래는 로컬 캐시에만 영향." : "로컬 stonkGachaState 데이터에만 영향을 줍니다."}</p>
      </div>
      <div class="detail-stats">
        ${renderMiniStat("Cash", `${formatNumber(state.money)}`)}
        ${renderMiniStat("Dust", formatNumber(state.dust))}
        ${renderMiniStat("Total Pulls", formatNumber(state.totalDraws || 0))}
        ${renderMiniStat("Dismantled", formatNumber(state.totalDismantled || 0))}
      </div>
    `,
    actions: [
      {
        id: "reset",
        label: "로컬 데이터 초기화",
        className: "danger-button modal-confirm",
        onClick: () => {
          state = resetState();
          filters.grade = "All";
          filters.type = "All";
          filters.ownedOnly = false;
          filters.query = "";
          renderApp();
          closeModal();
          showToast("로컬 STONK Gacha 데이터를 초기화했습니다.", "success");
        }
      }
    ]
  });
}

function scrollToArchive() {
  window.setTimeout(() => {
    document.querySelector(".collection-zone")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 40);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

// 종류(타입) 라벨 한글 표시 매핑 (내부 값/로직은 영어 유지)
const TYPE_KO = { Skin: "스킨", Frame: "프레임", Effect: "이펙트", Theme: "테마", ticket: "티켓", coupon: "쿠폰", piece: "조각", box: "박스", All: "전체" };
function typeKo(value) {
  return TYPE_KO[value] || value;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
