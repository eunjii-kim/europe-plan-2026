import { itineraryData } from './data.js';
import {
  TRIP_INFO,
  THEME_STORAGE_KEY,
  EDIT_MODE_STORAGE_KEY,
  EXCHANGE_RATE_REFRESH_INTERVAL_MS,
  ICONS,
  EXCLUDED_REGIONS,
  ADD_NEW_REGION_VALUE,
} from './constants.js';
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
  renderPlaceFilters,
  renderPlaceList,
  renderExpenseList,
  renderExpenseStats,
  PLACE_FILTER_ALL,
} from './render.js';
import { formatKrw, applyBudgetOverrides, applyCustomCostItems, groupCustomCostItemsByAnchorKey } from './budgetCalc.js';
import { applyScheduleOverrides } from './scheduleCalc.js';
import { setupScrollSpy } from './scrollSpy.js';
import {
  subscribeToBudgetItems,
  addBudgetItem,
  deleteBudgetItem,
  subscribeToBudgetOverrides,
  setBudgetOverride,
  clearBudgetOverride,
  addCustomCostItem,
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
import { subscribeToPlaces, addPlace, deletePlace, updatePlace } from './places.js';
import { subscribeToExpenses, addExpense, deleteExpense } from './expenses.js';
import { subscribeToCustomRegions, addCustomRegion } from './customRegions.js';
import { isFirebaseConfigured } from './firebaseConfig.js';

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
    info: document.getElementById('infoTab'),
    expense: document.getElementById('expenseTab'),
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

/**
 * 현재 라이트/다크 여부에 맞춰 테마 토글 버튼 아이콘을 그린다.
 * 지금 모드가 아니라 눌렀을 때 바뀔 모드를 아이콘으로 보여준다(라이트면 달, 다크면 해).
 * @param {HTMLElement} button
 * @param {'light' | 'dark'} current
 */
function renderThemeToggleIcon(button, current) {
  button.innerHTML = current === 'dark' ? ICONS.sun : ICONS.moon;
}

/** 라이트/다크 모드 토글 버튼을 연결한다. 선택값은 localStorage에 저장해 다음 방문에도 유지한다. */
function setupThemeToggle() {
  const root = document.documentElement;
  const button = document.getElementById('themeToggle');
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    root.dataset.theme = stored;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  renderThemeToggleIcon(button, root.dataset.theme || (prefersDark ? 'dark' : 'light'));

  button.addEventListener('click', () => {
    const current = root.dataset.theme || (prefersDark ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem(THEME_STORAGE_KEY, next);
    renderThemeToggleIcon(button, next);
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
  button.innerHTML = stored ? ICONS.wrench : ICONS.pencil;
  button.setAttribute('aria-pressed', String(stored));

  button.addEventListener('click', () => {
    const next = !isEditModeOn();
    document.body.classList.toggle('edit-mode', next);
    localStorage.setItem(EDIT_MODE_STORAGE_KEY, next ? 'on' : 'off');
    button.innerHTML = next ? ICONS.wrench : ICONS.pencil;
    button.setAttribute('aria-pressed', String(next));
    onToggle();
  });
}

/**
 * select 요소에 지역 옵션 목록을 채운다. 첫 옵션은 "지역 선택 안함", 마지막은 "+ 새 지역 추가"이다.
 * 호출할 때마다 기존 옵션을 지우고 다시 채운다(사용자가 추가한 지역이 실시간으로 반영되므로).
 * @param {HTMLSelectElement} selectEl
 * @param {string[]} regions
 */
function populateRegionSelect(selectEl, regions) {
  selectEl.innerHTML = '';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '지역 선택 안함';
  selectEl.appendChild(emptyOption);

  for (const region of regions) {
    const option = document.createElement('option');
    option.value = region;
    option.textContent = region;
    selectEl.appendChild(option);
  }

  const addNewOption = document.createElement('option');
  addNewOption.value = ADD_NEW_REGION_VALUE;
  addNewOption.textContent = '+ 새 지역 추가';
  selectEl.appendChild(addNewOption);
}

/**
 * 지역 select에서 "+ 새 지역 추가"를 골랐을 때 이름을 입력받아 Firestore에 저장한다.
 * 취소하거나 빈 값이면 이전 선택값으로 되돌린다.
 * @param {HTMLSelectElement} selectEl
 * @param {(selectEl: HTMLSelectElement, name: string) => void} onAdd
 */
function setupRegionAddOption(selectEl, onAdd) {
  selectEl.dataset.previousValue = selectEl.value;
  selectEl.addEventListener('change', async () => {
    if (selectEl.value !== ADD_NEW_REGION_VALUE) {
      selectEl.dataset.previousValue = selectEl.value;
      return;
    }
    const previousValue = selectEl.dataset.previousValue || '';
    const name = (window.prompt('추가할 지역/도시 이름을 입력하세요') || '').trim();
    if (!name) {
      selectEl.value = previousValue;
      return;
    }
    try {
      await onAdd(selectEl, name);
    } catch (error) {
      console.error('지역 추가 실패', error);
      showFirebaseNotice();
      selectEl.value = previousValue;
    }
  });
}

/**
 * 현재 열려있는 날짜 카드의 id 목록을 반환한다. 재렌더링 후에도 열림 상태를 복원하기 위해 쓴다.
 * @param {HTMLElement} listEl
 * @returns {Set<string>}
 */
function getOpenDayIds(listEl) {
  return new Set([...listEl.querySelectorAll('.day-card[open]')].map((card) => card.id));
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

/** Firebase 미설정/연결 실패 안내 배너를 (탭 상관없이) 모두 표시한다. */
function showFirebaseNotice() {
  const message = isFirebaseConfigured
    ? '서버 연결에 실패했습니다. 네트워크 상태를 확인해주세요.'
    : 'Firebase가 아직 설정되지 않았습니다. README.md의 안내에 따라 firebaseConfig.js를 설정하면 여러 기기 간 데이터 공유가 활성화됩니다.';
  document.querySelectorAll('.firebase-notice').forEach((notice) => {
    notice.hidden = false;
    notice.textContent = message;
  });
}

/** "정보" 탭의 장소 추가 폼 제출을 처리한다. */
function setupPlaceForm() {
  const form = document.getElementById('placeForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const category = document.getElementById('placeCategoryInput').value;
    const region = document.getElementById('placeRegionInput').value;
    const titleInput = document.getElementById('placeTitleInput');
    const linkInput = document.getElementById('placeLinkInput');
    const memoInput = document.getElementById('placeMemoInput');

    const title = titleInput.value.trim();
    if (!title) return;

    try {
      await addPlace({ category, region, title, link: linkInput.value.trim(), memo: memoInput.value.trim() });
      form.reset();
    } catch (error) {
      console.error('장소 추가 실패', error);
      showFirebaseNotice();
    }
  });
}

/** "소비기록" 탭의 지출 입력 폼 제출을 처리한다. */
function setupExpenseForm() {
  const form = document.getElementById('expenseForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const dateInput = document.getElementById('expenseDateInput');
    const category = document.getElementById('expenseCategoryInput').value;
    const region = document.getElementById('expenseRegionInput').value;
    const titleInput = document.getElementById('expenseTitleInput');
    const amountInput = document.getElementById('expenseAmountInput');
    const currencyInput = document.getElementById('expenseCurrencyInput');

    const date = dateInput.value;
    const amount = Number(amountInput.value);
    if (!date || !Number.isFinite(amount) || amount < 0) return;

    try {
      await addExpense({
        date,
        category,
        region,
        title: titleInput.value.trim(),
        amount,
        currency: currencyInput.value,
      });
      form.reset();
      dateInput.value = date;
    } catch (error) {
      console.error('지출 기록 추가 실패', error);
      showFirebaseNotice();
    }
  });
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
  setupPlaceForm();
  setupExpenseForm();

  const tripRegions = [...new Set(itineraryData.map((day) => day.region))].filter(
    (region) => !EXCLUDED_REGIONS.has(region),
  );
  const placeRegionInput = document.getElementById('placeRegionInput');
  const expenseRegionInput = document.getElementById('expenseRegionInput');

  let latestCustomRegions = [];
  let pendingRegionSelection = null;
  const refreshRegionSelects = () => {
    const regions = [...tripRegions, ...latestCustomRegions.map((r) => r.name)];
    for (const selectEl of [placeRegionInput, expenseRegionInput]) {
      const previousValue = selectEl.dataset.previousValue || '';
      populateRegionSelect(selectEl, regions);
      const nextValue =
        pendingRegionSelection?.selectEl === selectEl ? pendingRegionSelection.name : previousValue;
      if ([...selectEl.options].some((option) => option.value === nextValue)) {
        selectEl.value = nextValue;
      }
      selectEl.dataset.previousValue = selectEl.value;
    }
    pendingRegionSelection = null;
  };
  refreshRegionSelects();

  const onAddRegion = async (selectEl, name) => {
    pendingRegionSelection = { selectEl, name };
    try {
      await addCustomRegion(name);
    } catch (error) {
      pendingRegionSelection = null;
      throw error;
    }
  };
  setupRegionAddOption(placeRegionInput, onAddRegion);
  setupRegionAddOption(expenseRegionInput, onAddRegion);

  const expenseDateInput = document.getElementById('expenseDateInput');
  expenseDateInput.min = TRIP_INFO.startDate;
  expenseDateInput.max = TRIP_INFO.endDate;

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
    onAddCostItem: async (anchorKey, values) => {
      try {
        await addCustomCostItem(anchorKey, values);
      } catch (error) {
        console.error('비용 항목 추가 실패', error);
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
  };

  const dayNavEl = document.getElementById('dayNav');
  const tabBarEl = document.querySelector('.tab-bar');

  let latestPlaces = [];
  let placeFilterCategory = PLACE_FILTER_ALL;
  const renderPlacesTab = () => {
    const filtered =
      placeFilterCategory === PLACE_FILTER_ALL
        ? latestPlaces
        : latestPlaces.filter((item) => item.category === placeFilterCategory);
    renderPlaceFilters(document.getElementById('placeFilters'), placeFilterCategory, (category) => {
      placeFilterCategory = category;
      renderPlacesTab();
    });
    renderPlaceList(
      document.getElementById('placeList'),
      filtered,
      [...tripRegions, ...latestCustomRegions.map((r) => r.name)],
      async (id) => {
        try {
          await deletePlace(id);
        } catch (error) {
          console.error('장소 삭제 실패', error);
          showFirebaseNotice();
        }
      },
      async (id, values) => {
        try {
          await updatePlace(id, values);
        } catch (error) {
          console.error('장소 수정 실패', error);
          showFirebaseNotice();
        }
      },
    );
  };

  let latestExpenses = [];
  const renderExpenseTab = () => {
    renderExpenseList(document.getElementById('expenseList'), latestExpenses, rates, async (id) => {
      try {
        await deleteExpense(id);
      } catch (error) {
        console.error('지출 기록 삭제 실패', error);
        showFirebaseNotice();
      }
    });
    renderExpenseStats(document.getElementById('expenseStats'), latestExpenses, rates, plannedTotal);
  };

  let latestBudgetOverridesMap = new Map();
  let latestScheduleOverridesMap = new Map();
  let latestCustomBlocksByDay = new Map();
  let hasRenderedScheduleOnce = false;
  const renderScheduleAndSummary = () => {
    const budgetApplied = applyBudgetOverrides(itineraryData, latestBudgetOverridesMap);
    const scheduleApplied = applyScheduleOverrides(budgetApplied, latestScheduleOverridesMap, latestCustomBlocksByDay);
    const effectiveData = applyCustomCostItems(scheduleApplied, groupCustomCostItemsByAnchorKey(latestBudgetOverridesMap));
    const openDayIds = hasRenderedScheduleOnce ? getOpenDayIds(dayListEl) : null;
    renderDayNav(dayNavEl, effectiveData);
    renderDayList(dayListEl, effectiveData, rates, todayDayId, handlers, isEditModeOn(), openDayIds);
    hasRenderedScheduleOnce = true;
    plannedTotal = renderBudgetSummary(
      document.getElementById('categoryBreakdown'),
      document.getElementById('plannedTotal'),
      effectiveData,
      rates,
    );
    updateGrandTotal();
    renderExpenseTab();
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
  renderPlacesTab();

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
    subscribeToPlaces((items) => {
      latestPlaces = items;
      renderPlacesTab();
    }, () => showFirebaseNotice());
    subscribeToExpenses((items) => {
      latestExpenses = items;
      renderExpenseTab();
    }, () => showFirebaseNotice());
    subscribeToCustomRegions((regions) => {
      latestCustomRegions = regions;
      refreshRegionSelects();
      renderPlacesTab();
    }, () => showFirebaseNotice());
  }
}

main();
