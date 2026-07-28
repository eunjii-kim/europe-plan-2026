import { itineraryData } from './data.js';
import { TRIP_INFO, THEME_STORAGE_KEY, EDIT_MODE_STORAGE_KEY, EXCHANGE_RATE_REFRESH_INTERVAL_MS } from './constants.js';
import { getExchangeRates } from './exchangeRate.js';
import {
  computeDdayLabel,
  renderDayNav,
  renderDayList,
  setAllDayCardsOpen,
  renderRateStatus,
  renderRateStatusCompact,
  renderBudgetSummary,
  renderBudgetList,
} from './render.js';
import { formatKrw, applyBudgetOverrides } from './budgetCalc.js';
import { applyScheduleOverrides } from './scheduleCalc.js';
import { setupScrollSpy } from './scrollSpy.js';
import {
  subscribeToBudgetItems,
  addBudgetItem,
  deleteBudgetItem,
  subscribeToBudgetOverrides,
  setBudgetOverride,
  clearBudgetOverride,
} from './budget.js';
import {
  subscribeToScheduleOverrides,
  setScheduleOverride,
  clearScheduleOverride,
  subscribeToScheduleCustomBlocks,
  addScheduleCustomBlock,
  deleteScheduleCustomBlock,
  updateScheduleCustomBlockAttachments,
} from './schedule.js';
import { uploadScheduleAttachment } from './storage.js';
import { isFirebaseConfigured } from './firebaseConfig.js';

const EDIT_MODE_ICONS = { off: '✏️', on: '🔧' };

/**
 * 오늘 날짜를 시간대 이슈 없이 'YYYY-MM-DD' 문자열로 변환한다.
 * @param {Date} date
 * @returns {string}
 */
function toIsoDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 탭 버튼과 패널을 서로 연결한다. */
function setupTabs() {
  const buttons = document.querySelectorAll('.tab-button');
  const panels = {
    schedule: document.getElementById('scheduleTab'),
    budget: document.getElementById('budgetTab'),
  };
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((b) => b.setAttribute('aria-selected', String(b === button)));
      Object.entries(panels).forEach(([key, panel]) => {
        panel.hidden = key !== button.dataset.tab;
      });
    });
  });
}

/** 라이트/다크 모드 토글 버튼을 연결한다. 선택값은 localStorage에 저장해 다음 방문에도 유지한다. */
function setupThemeToggle() {
  const root = document.documentElement;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    root.dataset.theme = stored;
  }

  document.getElementById('themeToggle').addEventListener('click', () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const current = root.dataset.theme || (prefersDark ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem(THEME_STORAGE_KEY, next);
  });
}

/** 현재 편집모드가 켜져 있는지 확인한다. */
function isEditModeOn() {
  return document.body.classList.contains('edit-mode');
}

/**
 * 편집모드 토글 버튼을 연결한다. 선택값은 localStorage에 저장해 다음 방문에도 유지한다.
 * @param {() => void} onToggle - 켜짐/꺼짐이 바뀔 때마다 화면을 다시 그리기 위한 콜백
 */
function setupEditModeToggle(onToggle) {
  const button = document.getElementById('editModeToggle');
  const stored = localStorage.getItem(EDIT_MODE_STORAGE_KEY) === 'on';
  document.body.classList.toggle('edit-mode', stored);
  button.textContent = stored ? EDIT_MODE_ICONS.on : EDIT_MODE_ICONS.off;
  button.setAttribute('aria-pressed', String(stored));

  button.addEventListener('click', () => {
    const next = !isEditModeOn();
    document.body.classList.toggle('edit-mode', next);
    localStorage.setItem(EDIT_MODE_STORAGE_KEY, next ? 'on' : 'off');
    button.textContent = next ? EDIT_MODE_ICONS.on : EDIT_MODE_ICONS.off;
    button.setAttribute('aria-pressed', String(next));
    onToggle();
  });
}

/** 일정 탭의 모두 펼치기/모두 접기 버튼을 연결한다. */
function setupExpandCollapseButtons() {
  const dayList = document.getElementById('dayList');
  document.getElementById('expandAllButton').addEventListener('click', () => {
    setAllDayCardsOpen(dayList, true);
  });
  document.getElementById('collapseAllButton').addEventListener('click', () => {
    setAllDayCardsOpen(dayList, false);
  });
}

/** 예산 입력 폼 제출을 처리한다. */
function setupBudgetForm() {
  const form = document.getElementById('budgetForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const titleInput = document.getElementById('budgetTitleInput');
    const amountInput = document.getElementById('budgetAmountInput');
    const currencyInput = document.getElementById('budgetCurrencyInput');

    const title = titleInput.value.trim();
    const amount = Number(amountInput.value);
    const currency = currencyInput.value;
    if (!title || !Number.isFinite(amount) || amount < 0) return;

    try {
      await addBudgetItem({ title, amount, currency });
      form.reset();
    } catch (error) {
      console.error('예산 항목 추가 실패', error);
      showFirebaseNotice();
    }
  });
}

/**
 * Firebase 미설정/연결 실패 안내 배너를 표시한다.
 * @param {string} [customMessage] - 지정하면 기본 안내 문구 대신 이 메시지를 보여준다.
 */
function showFirebaseNotice(customMessage) {
  const notice = document.getElementById('firebaseNotice');
  notice.hidden = false;
  if (customMessage) {
    notice.textContent = customMessage;
    return;
  }
  notice.textContent = isFirebaseConfigured
    ? '예산 서버 연결에 실패했습니다. 네트워크 상태를 확인해주세요.'
    : 'Firebase가 아직 설정되지 않았습니다. README.md의 안내에 따라 firebaseConfig.js를 설정하면 여러 기기 간 예산 공유가 활성화됩니다.';
}

/**
 * 일정 블록(기존 블록 또는 사용자가 추가한 블록)의 첨부 목록을 저장한다.
 * @param {object} block
 * @param {Array<{ type: string, url: string, label?: string }>} attachments
 * @returns {Promise<void>}
 */
async function saveBlockAttachments(block, attachments) {
  if (block.isCustom) {
    await updateScheduleCustomBlockAttachments(block.customId, attachments);
  } else {
    await setScheduleOverride(block.blockKey, {
      time: block.time,
      title: block.title,
      note: block.note || '',
      attachments,
    });
  }
}

async function main() {
  document.getElementById('tripTitle').textContent = TRIP_INFO.title;
  document.getElementById('tripSub').textContent = `${TRIP_INFO.regionLabel} · ${TRIP_INFO.startDate} ~ ${TRIP_INFO.endDate}`;
  document.getElementById('ddayLabel').textContent = computeDdayLabel(TRIP_INFO);

  setupTabs();
  setupThemeToggle();
  setupExpandCollapseButtons();
  setupBudgetForm();

  const rateStatusEl = document.getElementById('rateStatus');
  const headerRateStatusEl = document.getElementById('headerRateStatus');
  rateStatusEl.textContent = '환율 정보를 불러오는 중...';

  let rates = await getExchangeRates();
  renderRateStatus(rateStatusEl, rates);
  renderRateStatusCompact(headerRateStatusEl, rates);

  const todayId = `d${toIsoDate(new Date())}`;
  const todayDayId = itineraryData.some((day) => day.id === todayId) ? todayId : null;

  const dayListEl = document.getElementById('dayList');
  const grandTotalEl = document.getElementById('grandTotal');

  let plannedTotal = 0;
  let customTotal = 0;
  const updateGrandTotal = () => {
    grandTotalEl.textContent = `전체 예상 총액: ${formatKrw(plannedTotal + customTotal)}`;
  };

  const handlers = {
    onEditCostItem: async (key, values) => {
      try {
        await setBudgetOverride(key, values);
      } catch (error) {
        console.error('일정 비용 수정 실패', error);
        showFirebaseNotice();
      }
    },
    onResetCostItem: async (key) => {
      try {
        await clearBudgetOverride(key);
      } catch (error) {
        console.error('일정 비용 초기화 실패', error);
        showFirebaseNotice();
      }
    },
    onEditBlock: async (blockKey, values) => {
      try {
        await setScheduleOverride(blockKey, values);
      } catch (error) {
        console.error('일정 내용 수정 실패', error);
        showFirebaseNotice();
      }
    },
    onDeleteBlock: async (blockKey, currentValues) => {
      try {
        await setScheduleOverride(blockKey, { ...currentValues, deleted: true });
      } catch (error) {
        console.error('일정 삭제 실패', error);
        showFirebaseNotice();
      }
    },
    onRestoreBlock: async (blockKey) => {
      try {
        await clearScheduleOverride(blockKey);
      } catch (error) {
        console.error('일정 되돌리기 실패', error);
        showFirebaseNotice();
      }
    },
    onAddBlock: async (dayId, values) => {
      try {
        await addScheduleCustomBlock(dayId, values);
      } catch (error) {
        console.error('일정 추가 실패', error);
        showFirebaseNotice();
      }
    },
    onDeleteCustomBlock: async (customId) => {
      try {
        await deleteScheduleCustomBlock(customId);
      } catch (error) {
        console.error('추가한 일정 삭제 실패', error);
        showFirebaseNotice();
      }
    },
    onAddAttachment: async (block, attachment) => {
      try {
        await saveBlockAttachments(block, [...(block.attachments || []), attachment]);
      } catch (error) {
        console.error('첨부 추가 실패', error);
        showFirebaseNotice();
      }
    },
    onRemoveAttachment: async (block, index) => {
      try {
        await saveBlockAttachments(block, (block.attachments || []).filter((_, i) => i !== index));
      } catch (error) {
        console.error('첨부 삭제 실패', error);
        showFirebaseNotice();
      }
    },
    onUploadAttachment: async (block, file) => {
      try {
        const url = await uploadScheduleAttachment(file, block.blockKey || block.customId);
        await saveBlockAttachments(block, [...(block.attachments || []), { type: 'image', url, label: '' }]);
      } catch (error) {
        console.error('첨부 파일 업로드 실패', error);
        showFirebaseNotice(
          'Storage가 활성화되어 있는지 확인해주세요. 자세한 내용은 README.md를 참고하세요.',
        );
      }
    },
  };

  const dayNavEl = document.getElementById('dayNav');
  const tabBarEl = document.querySelector('.tab-bar');

  let latestBudgetOverridesMap = new Map();
  let latestScheduleOverridesMap = new Map();
  let latestCustomBlocksByDay = new Map();
  const renderScheduleAndSummary = () => {
    const budgetApplied = applyBudgetOverrides(itineraryData, latestBudgetOverridesMap);
    const effectiveData = applyScheduleOverrides(budgetApplied, latestScheduleOverridesMap, latestCustomBlocksByDay);
    renderDayNav(dayNavEl, effectiveData);
    renderDayList(dayListEl, effectiveData, rates, todayDayId, handlers, isEditModeOn());
    plannedTotal = renderBudgetSummary(
      document.getElementById('categoryBreakdown'),
      document.getElementById('plannedTotal'),
      effectiveData,
      rates,
    );
    updateGrandTotal();
    setupScrollSpy(dayListEl, dayNavEl, tabBarEl);
  };

  let latestBudgetItems = [];
  const renderCustomBudgetList = (items) => {
    latestBudgetItems = items;
    customTotal = renderBudgetList(document.getElementById('budgetList'), items, rates, async (id) => {
      try {
        await deleteBudgetItem(id);
      } catch (error) {
        console.error('예산 항목 삭제 실패', error);
        showFirebaseNotice();
      }
    });
    document.getElementById('customTotal').textContent = `추가 예산 합계: ${formatKrw(customTotal)}`;
    updateGrandTotal();
  };

  /** 환율을 다시 조회하고, 환율에 의존하는 모든 화면(헤더/일정/예산)을 재렌더링한다. */
  async function refreshRates() {
    rates = await getExchangeRates();
    renderRateStatus(rateStatusEl, rates);
    renderRateStatusCompact(headerRateStatusEl, rates);
    renderScheduleAndSummary();
    renderCustomBudgetList(latestBudgetItems);
  }
  setInterval(refreshRates, EXCHANGE_RATE_REFRESH_INTERVAL_MS);

  setupEditModeToggle(renderScheduleAndSummary);

  // Firestore 연결 여부와 상관없이 일정/예산 요약은 항상 먼저 보여준다.
  renderScheduleAndSummary();

  if (!isFirebaseConfigured) {
    showFirebaseNotice();
  } else {
    subscribeToBudgetOverrides((map) => {
      latestBudgetOverridesMap = map;
      renderScheduleAndSummary();
    }, () => showFirebaseNotice());
    subscribeToScheduleOverrides((map) => {
      latestScheduleOverridesMap = map;
      renderScheduleAndSummary();
    }, () => showFirebaseNotice());
    subscribeToScheduleCustomBlocks((byDay) => {
      latestCustomBlocksByDay = byDay;
      renderScheduleAndSummary();
    }, () => showFirebaseNotice());
    subscribeToBudgetItems(renderCustomBudgetList, () => showFirebaseNotice());
  }
}

main();
