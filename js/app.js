import { itineraryData } from './data.js';
import {
  TRIP_INFO,
  THEME_STORAGE_KEY,
  EXCHANGE_RATE_REFRESH_INTERVAL_MS,
  ICONS,
  EXCLUDED_REGIONS,
  ADD_NEW_REGION_VALUE,
  ADD_NEW_CATEGORY_VALUE,
  PLACE_CATEGORIES,
  PLACE_CATEGORY_ICONS,
  DEFAULT_TAB,
  SCHEDULE_TAB,
  SCROLL_RESTORE_TOLERANCE_PX,
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
  renderChecklistSections,
  renderMemoList,
  PLACE_FILTER_ALL,
} from './render.js';
import {
  formatKrw,
  applyBudgetOverrides,
  applyCustomCostItems,
  groupCustomCostItemsByAnchorKey,
  isCustomCostItemKey,
} from './budgetCalc.js';
import { UNSPECIFIED_REGION_LABEL } from './expenseCalc.js';
import { applyScheduleOverrides } from './scheduleCalc.js';
import { setupScrollSpy, updateActiveDayPill } from './scrollSpy.js';
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
  updateScheduleCustomBlock,
  updateScheduleCustomBlockAttachments,
  updateScheduleCustomBlockLinkedPlaces,
} from './schedule.js';
import { subscribeToPlaces, addPlace, deletePlace, updatePlace, toggleFavoritePlace } from './places.js';
import { subscribeToExpenses, addExpense, deleteExpense, updateExpense } from './expenses.js';
import {
  subscribeToChecklistSections,
  addChecklistSection,
  deleteChecklistSection,
  updateChecklistSection,
  subscribeToChecklistItems,
  addChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
  updateChecklistItemMemo,
  updateChecklistItemLink,
  updateChecklistItemTitle,
} from './checklist.js';
import { subscribeToMemos, addMemo, deleteMemo, updateMemo } from './memos.js';
import { formatMegabytes, measureMemoSize } from './memoAttachments.js';
import { createMemoAttachmentsEditor } from './memoEditor.js';
import { subscribeToCustomRegions, addCustomRegion } from './customRegions.js';
import { subscribeToCustomPlaceCategories, addCustomPlaceCategory } from './customPlaceCategories.js';
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

/**
 * 한 줄 입력칸에서 Enter를 눌러도 폼이 곧바로 제출되지 않게 막는다.
 * 실수로 입력 도중 등록되는 것을 막고, 항상 저장/추가 버튼을 눌러 확정하게 한다.
 * textarea(줄바꿈)와 버튼(Enter로 누르기)은 그대로 둔다.
 */
function setupEnterKeyGuard() {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.form) return;
    event.preventDefault();
  });
}

/**
 * 탭 버튼과 패널을 서로 연결한다.
 * 탭을 떠날 때 현재 스크롤 위치를 기억해 두었다가 다시 돌아오면 그대로 복원한다.
 * 이 처리가 없으면 메모처럼 짧은 탭으로 갔을 때 문서 높이가 줄면서 브라우저가
 * 스크롤을 맨 위로 잘라내고, 일정 탭으로 돌아왔을 때 항상 첫 번째 날짜가 보인다.
 */
function setupTabs() {
  const buttons = document.querySelectorAll('.tab-button');
  const panels = {
    schedule: document.getElementById('scheduleTab'),
    budget: document.getElementById('budgetTab'),
    info: document.getElementById('infoTab'),
    expense: document.getElementById('expenseTab'),
    checklist: document.getElementById('checklistTab'),
    memo: document.getElementById('memoTab'),
  };
  const scrollPositions = {};
  let activeTab = DEFAULT_TAB;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextTab = button.dataset.tab;
      if (nextTab === activeTab) return;

      scrollPositions[activeTab] = window.scrollY;
      activeTab = nextTab;

      buttons.forEach((b) => b.setAttribute('aria-selected', String(b === button)));
      Object.entries(panels).forEach(([key, panel]) => {
        panel.hidden = key !== nextTab;
      });

      restoreTabScroll(scrollPositions[nextTab] || 0);

      // 숨어 있는 동안 일정이 다시 그려졌다면 날짜 pill 하이라이트가 지워져 있으므로 다시 맞춘다.
      if (nextTab === SCHEDULE_TAB) {
        updateActiveDayPill(
          document.getElementById('dayList'),
          document.getElementById('dayNav'),
          document.querySelector('.tab-bar'),
        );
      }
    });
  });
}

/**
 * 탭을 전환한 직후 저장해 둔 스크롤 위치로 되돌린다.
 * 패널을 막 보이게 한 시점에는 아직 문서 높이가 반영되지 않아 한 번에 복원되지 않을 수 있으므로,
 * 다음 프레임에 한 번 더 시도한다.
 * @param {number} scrollY
 */
function restoreTabScroll(scrollY) {
  window.scrollTo(0, scrollY);
  requestAnimationFrame(() => {
    if (Math.abs(window.scrollY - scrollY) > SCROLL_RESTORE_TOLERANCE_PX) {
      window.scrollTo(0, scrollY);
    }
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


/**
 * select 요소에 옵션 목록 + "+ 새 항목 추가" 옵션을 채우는 공용 헬퍼.
 * 호출할 때마다 기존 옵션을 지우고 다시 채운다(사용자가 추가한 항목이 실시간으로 반영되므로).
 * @param {HTMLSelectElement} selectEl
 * @param {string[]} values
 * @param {{ emptyOptionLabel?: string, addNewOptionValue: string, addNewOptionLabel: string, renderOptionLabel?: (value: string) => string }} opts
 */
function populateSelectWithAddOption(selectEl, values, opts) {
  selectEl.innerHTML = '';

  if (opts.emptyOptionLabel) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = opts.emptyOptionLabel;
    selectEl.appendChild(emptyOption);
  }

  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = opts.renderOptionLabel ? opts.renderOptionLabel(value) : value;
    selectEl.appendChild(option);
  }

  const addNewOption = document.createElement('option');
  addNewOption.value = opts.addNewOptionValue;
  addNewOption.textContent = opts.addNewOptionLabel;
  selectEl.appendChild(addNewOption);
}

/**
 * select에서 "+ 새 항목 추가"를 골랐을 때 이름을 입력받아 Firestore에 저장하는 공용 헬퍼.
 * 취소하거나 빈 값이면 이전 선택값으로 되돌린다.
 * @param {HTMLSelectElement} selectEl
 * @param {{ addNewOptionValue: string, promptMessage: string }} opts
 * @param {(selectEl: HTMLSelectElement, name: string) => void} onAdd
 */
function setupAddOption(selectEl, opts, onAdd) {
  selectEl.dataset.previousValue = selectEl.value;
  selectEl.addEventListener('change', async () => {
    if (selectEl.value !== opts.addNewOptionValue) {
      selectEl.dataset.previousValue = selectEl.value;
      return;
    }
    const previousValue = selectEl.dataset.previousValue || '';
    const name = (window.prompt(opts.promptMessage) || '').trim();
    if (!name) {
      selectEl.value = previousValue;
      return;
    }
    try {
      await onAdd(selectEl, name);
    } catch (error) {
      console.error('항목 추가 실패', error);
      showFirebaseNotice();
      selectEl.value = previousValue;
    }
  });
}

/**
 * select 요소에 지역 옵션 목록을 채운다. 첫 옵션은 "지역 선택 안함", 마지막은 "+ 새 지역 추가"이다.
 * @param {HTMLSelectElement} selectEl
 * @param {string[]} regions
 */
function populateRegionSelect(selectEl, regions) {
  populateSelectWithAddOption(selectEl, regions, {
    emptyOptionLabel: '지역 선택 안함',
    addNewOptionValue: ADD_NEW_REGION_VALUE,
    addNewOptionLabel: '+ 새 지역 추가',
  });
}

/**
 * 지역 select에서 "+ 새 지역 추가"를 골랐을 때 이름을 입력받아 Firestore에 저장한다.
 * @param {HTMLSelectElement} selectEl
 * @param {(selectEl: HTMLSelectElement, name: string) => void} onAdd
 */
function setupRegionAddOption(selectEl, onAdd) {
  setupAddOption(selectEl, { addNewOptionValue: ADD_NEW_REGION_VALUE, promptMessage: '추가할 지역/도시 이름을 입력하세요' }, onAdd);
}

/**
 * select 요소에 분류 옵션 목록을 채운다. 마지막은 "+ 새 분류 추가"이다.
 * @param {HTMLSelectElement} selectEl
 * @param {string[]} categories
 */
function populateCategorySelect(selectEl, categories) {
  populateSelectWithAddOption(selectEl, categories, {
    addNewOptionValue: ADD_NEW_CATEGORY_VALUE,
    addNewOptionLabel: '+ 새 분류 추가',
    renderOptionLabel: (category) => {
      const icon = PLACE_CATEGORY_ICONS[category];
      return icon ? `${icon} ${category}` : category;
    },
  });
}

/**
 * 분류 select에서 "+ 새 분류 추가"를 골랐을 때 이름을 입력받아 Firestore에 저장한다.
 * @param {HTMLSelectElement} selectEl
 * @param {(selectEl: HTMLSelectElement, name: string) => void} onAdd
 */
function setupCategoryAddOption(selectEl, onAdd) {
  setupAddOption(selectEl, { addNewOptionValue: ADD_NEW_CATEGORY_VALUE, promptMessage: '추가할 분류 이름을 입력하세요 (예: 야경 명소)' }, onAdd);
}

/**
 * 현재 열려있는 날짜 카드의 id 목록을 반환한다. 재렌더링 후에도 열림 상태를 복원하기 위해 쓴다.
 * @param {HTMLElement} listEl
 * @returns {Set<string>}
 */
function getOpenDayIds(listEl) {
  return new Set([...listEl.querySelectorAll('.day-card[open]')].map((card) => card.id));
}

/**
 * 병합된 일정 데이터에서 일정에 연결된 장소들을 placeId별 방문 날짜(MM/DD) 목록으로 모은다.
 * @param {Array} effectiveScheduleData - applyScheduleOverrides 등을 거친 병합 일정 데이터
 * @returns {Map<string, string[]>}
 */
function buildPlaceScheduleDates(effectiveScheduleData) {
  const map = new Map();
  for (const day of effectiveScheduleData) {
    const monthDay = `${day.date.slice(5, 7)}/${day.date.slice(8, 10)}`;
    for (const block of day.timeBlocks) {
      for (const entry of block.linkedPlaces || []) {
        const dates = map.get(entry.placeId) || [];
        if (!dates.includes(monthDay)) dates.push(monthDay);
        map.set(entry.placeId, dates);
      }
    }
  }
  return map;
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

/**
 * "메모" 탭 안내 문구를 띄운다. 서버 문제가 아닌 용량 초과 같은 상황도 같은 자리에 보여준다.
 * @param {string} message
 */
function showMemoNotice(message) {
  const notice = document.querySelector('#memoTab .firebase-notice');
  if (!notice) return;
  notice.hidden = false;
  notice.textContent = message;
}

/** "메모" 탭 안내 문구를 감춘다. */
function hideMemoNotice() {
  const notice = document.querySelector('#memoTab .firebase-notice');
  if (notice) notice.hidden = true;
}

/**
 * 메모가 Firestore 문서 한도를 넘지 않는지 확인한다.
 * 사진을 문서 안에 직접 넣는 구조라, 저장을 시도했다가 실패하는 대신 미리 이유를 알려준다.
 * @param {{ title: string, content: string, images: Array, tables: Array }} memo
 * @returns {boolean} 저장해도 되는지 여부
 */
function ensureMemoWithinLimit(memo) {
  const { withinLimit, bytes, limitBytes } = measureMemoSize(memo);
  if (withinLimit) return true;
  showMemoNotice(
    `사진 용량이 너무 큽니다(${formatMegabytes(bytes)}). 메모 하나에는 ${formatMegabytes(limitBytes)}까지만 담을 수 있으니 사진을 몇 장 빼고 저장해 주세요.`,
  );
  return false;
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
    const headcountInput = document.getElementById('expenseHeadcountInput');

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
        headcount: Number(headcountInput.value) || 1,
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
 * "체크리스트" 탭의 섹션 추가 폼 제출을 처리한다.
 * @param {() => number} getSectionCount - 신규 섹션의 order 값으로 쓸 현재 섹션 개수를 반환
 */
function setupChecklistSectionForm(getSectionCount) {
  const form = document.getElementById('checklistSectionForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const titleInput = document.getElementById('checklistSectionTitleInput');
    const title = titleInput.value.trim();
    if (!title) return;

    try {
      await addChecklistSection(title, getSectionCount());
      form.reset();
    } catch (error) {
      console.error('체크리스트 섹션 추가 실패', error);
      showFirebaseNotice();
    }
  });
}

/** "메모" 탭의 "+ 글쓰기" 토글 버튼과 작성 폼을 연결한다. */
function setupMemoForm() {
  const toggleButton = document.getElementById('memoAddToggle');
  const form = document.getElementById('memoForm');
  const titleInput = document.getElementById('memoTitleInput');
  const cancelButton = document.getElementById('memoCancelButton');

  // 카드 인라인 수정 폼(render.js)과 똑같은 사진/표 편집기를 여기에도 붙인다.
  const attachments = createMemoAttachmentsEditor();
  document.getElementById('memoAttachmentsEditor').appendChild(attachments.element);

  const closeForm = () => {
    form.reset();
    // form.reset()은 자바스크립트로 만든 사진/표까지 지우지는 못하므로 편집기를 따로 비운다.
    attachments.reset();
    form.hidden = true;
    hideMemoNotice();
  };

  toggleButton.addEventListener('click', () => {
    form.hidden = !form.hidden;
    if (!form.hidden) titleInput.focus();
  });

  cancelButton.addEventListener('click', closeForm);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const contentInput = document.getElementById('memoContentInput');
    const title = titleInput.value.trim();
    if (!title) return;

    const memo = { title, content: contentInput.value.trim(), ...attachments.collect() };
    if (!ensureMemoWithinLimit(memo)) return;

    try {
      await addMemo(memo);
      closeForm();
    } catch (error) {
      console.error('메모 추가 실패', error);
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
      linkedPlaces: block.linkedPlaces || [],
    });
  }
}

/**
 * 일정 블록(기존 블록 또는 사용자가 추가한 블록)에 연결된 정보(장소) 목록을 저장한다.
 * @param {object} block
 * @param {Array<{ id: string, placeId: string, category: string, title: string, budget?: { currency: string, amount: number } }>} linkedPlaces
 * @returns {Promise<void>}
 */
async function saveBlockLinkedPlaces(block, linkedPlaces) {
  if (block.isCustom) {
    await updateScheduleCustomBlockLinkedPlaces(block.customId, linkedPlaces);
  } else {
    await setScheduleOverride(block.blockKey, {
      time: block.time,
      title: block.title,
      note: block.note || '',
      attachments: block.attachments || [],
      linkedPlaces,
    });
  }
}

/**
 * 일정 수정 폼에서 함께 편집한 예산 변경분을 한 번에 반영한다.
 * 저장 대상이 원본 항목인지 사용자가 추가한 항목인지에 따라 삭제 방식이 다르다.
 * @param {string} anchorKey - 원본 블록의 blockKey 또는 사용자가 추가한 블록의 customId
 * @param {{ items: Array, removedItems: Array, resetKeys: string[] }} budget - renderBudgetEditSection.collect()의 결과
 * @returns {Promise<void>}
 */
async function saveBlockBudget(anchorKey, budget) {
  const { items = [], removedItems = [], resetKeys = [] } = budget || {};
  await Promise.all([
    // 사용자가 추가한 항목은 문서를 지우면 그대로 사라지지만,
    // 원본 항목은 문서를 지우면 data.js 값이 다시 살아나므로 삭제 표시를 남겨야 한다.
    ...removedItems.map((item) =>
      isCustomCostItemKey(item.key)
        ? clearBudgetOverride(item.key)
        : setBudgetOverride(item.key, { ...item, deleted: true }),
    ),
    ...resetKeys.map((key) => clearBudgetOverride(key)),
    ...items.map((item) => (item.key ? setBudgetOverride(item.key, item) : addCustomCostItem(anchorKey, item))),
  ]);
}

async function main() {
  document.getElementById('tripTitle').textContent = TRIP_INFO.title;
  document.getElementById('tripSub').textContent = `${TRIP_INFO.regionLabel} · ${TRIP_INFO.startDate} ~ ${TRIP_INFO.endDate}`;
  document.getElementById('ddayLabel').textContent = computeDdayLabel(TRIP_INFO);

  setupEnterKeyGuard();
  setupTabs();
  setupThemeToggle();
  setupExpandCollapseButtons();
  setupBudgetForm();
  setupPlaceForm();
  setupExpenseForm();
  setupChecklistSectionForm(() => latestChecklistSections.length);
  setupMemoForm();

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

  const placeCategoryInput = document.getElementById('placeCategoryInput');
  let latestCustomPlaceCategories = [];
  let pendingCategorySelection = null;
  const refreshCategorySelects = () => {
    const categories = [...PLACE_CATEGORIES, ...latestCustomPlaceCategories.map((c) => c.name)];
    const previousValue = placeCategoryInput.dataset.previousValue || '';
    populateCategorySelect(placeCategoryInput, categories);
    const nextValue = pendingCategorySelection ? pendingCategorySelection.name : previousValue;
    if ([...placeCategoryInput.options].some((option) => option.value === nextValue)) {
      placeCategoryInput.value = nextValue;
    }
    placeCategoryInput.dataset.previousValue = placeCategoryInput.value;
    pendingCategorySelection = null;
  };
  refreshCategorySelects();

  const onAddCategory = async (selectEl, name) => {
    pendingCategorySelection = { name };
    try {
      await addCustomPlaceCategory(name);
    } catch (error) {
      pendingCategorySelection = null;
      throw error;
    }
  };
  setupCategoryAddOption(placeCategoryInput, onAddCategory);

  const expenseDateInput = document.getElementById('expenseDateInput');
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
    onEditBlock: async (blockKey, values) => {
      try {
        await setScheduleOverride(blockKey, values);
        await saveBlockBudget(blockKey, values.budget);
        scheduleEditingBlockId = null;
        renderScheduleAndSummary();
      } catch (error) {
        console.error('일정 내용 수정 실패', error);
        showFirebaseNotice();
      }
    },
    onEditCustomBlock: async (customId, values) => {
      try {
        await updateScheduleCustomBlock(customId, values);
        await saveBlockBudget(customId, values.budget);
        scheduleEditingBlockId = null;
        renderScheduleAndSummary();
      } catch (error) {
        console.error('추가한 일정 수정 실패', error);
        showFirebaseNotice();
      }
    },
    onStartEditBlock: (blockId) => {
      scheduleEditingBlockId = blockId;
      renderScheduleAndSummary();
    },
    onCancelEditBlock: () => {
      scheduleEditingBlockId = null;
      renderScheduleAndSummary();
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
    onAddLinkedPlace: async (block, entry) => {
      try {
        await saveBlockLinkedPlaces(block, [...(block.linkedPlaces || []), entry]);
      } catch (error) {
        console.error('정보 연결 실패', error);
        showFirebaseNotice();
      }
    },
    onRemoveLinkedPlace: async (block, entryId) => {
      try {
        await saveBlockLinkedPlaces(block, (block.linkedPlaces || []).filter((entry) => entry.id !== entryId));
      } catch (error) {
        console.error('정보 연결 해제 실패', error);
        showFirebaseNotice();
      }
    },
  };

  const dayNavEl = document.getElementById('dayNav');
  const tabBarEl = document.querySelector('.tab-bar');

  let latestPlaces = [];
  let latestEffectiveScheduleData = [];
  let placeEditingId = null;
  let placeFilterCategory = PLACE_FILTER_ALL;
  let placeFilterRegion = PLACE_FILTER_ALL;
  let placeFavoriteOnly = false;
  const renderPlacesTab = () => {
    const allPlaceCategories = [...PLACE_CATEGORIES, ...latestCustomPlaceCategories.map((c) => c.name)];
    const allPlaceRegions = [...tripRegions, ...latestCustomRegions.map((r) => r.name)];
    let filtered =
      placeFilterCategory === PLACE_FILTER_ALL
        ? latestPlaces
        : latestPlaces.filter((item) => item.category === placeFilterCategory);
    if (placeFilterRegion === UNSPECIFIED_REGION_LABEL) {
      filtered = filtered.filter((item) => !item.region);
    } else if (placeFilterRegion !== PLACE_FILTER_ALL) {
      filtered = filtered.filter((item) => item.region === placeFilterRegion);
    }
    if (placeFavoriteOnly) {
      filtered = filtered.filter((item) => item.favorite === true);
    }
    renderPlaceFilters(
      document.getElementById('placeFilters'),
      allPlaceCategories,
      placeFilterCategory,
      allPlaceRegions,
      placeFilterRegion,
      placeFavoriteOnly,
      (category) => {
        placeFilterCategory = category;
        renderPlacesTab();
      },
      (region) => {
        placeFilterRegion = region;
        renderPlacesTab();
      },
      () => {
        placeFavoriteOnly = !placeFavoriteOnly;
        renderPlacesTab();
      },
    );
    renderPlaceList(
      document.getElementById('placeList'),
      filtered,
      allPlaceCategories,
      allPlaceRegions,
      buildPlaceScheduleDates(latestEffectiveScheduleData),
      placeEditingId,
      {
        onDelete: async (id) => {
          try {
            await deletePlace(id);
          } catch (error) {
            console.error('장소 삭제 실패', error);
            showFirebaseNotice();
          }
        },
        onSave: async (id, values) => {
          try {
            await updatePlace(id, values);
            placeEditingId = null;
            renderPlacesTab();
          } catch (error) {
            console.error('장소 수정 실패', error);
            showFirebaseNotice();
          }
        },
        onStartEdit: (id) => {
          placeEditingId = id;
          renderPlacesTab();
        },
        onCancelEdit: () => {
          placeEditingId = null;
          renderPlacesTab();
        },
        onToggleFavorite: async (id, favorite) => {
          try {
            await toggleFavoritePlace(id, favorite);
          } catch (error) {
            console.error('장소 즐겨찾기 변경 실패', error);
            showFirebaseNotice();
          }
        },
      },
    );
  };

  let latestExpenses = [];
  let expenseEditingId = null;
  let expensePerPersonView = false;
  const renderExpenseTab = () => {
    renderExpenseList(
      document.getElementById('expenseList'),
      latestExpenses,
      rates,
      [...tripRegions, ...latestCustomRegions.map((r) => r.name)],
      expenseEditingId,
      {
        onDelete: async (id) => {
          try {
            await deleteExpense(id);
          } catch (error) {
            console.error('지출 기록 삭제 실패', error);
            showFirebaseNotice();
          }
        },
        onSave: async (id, values) => {
          try {
            await updateExpense(id, values);
            expenseEditingId = null;
            renderExpenseTab();
          } catch (error) {
            console.error('지출 기록 수정 실패', error);
            showFirebaseNotice();
          }
        },
        onStartEdit: (id) => {
          expenseEditingId = id;
          renderExpenseTab();
        },
        onCancelEdit: () => {
          expenseEditingId = null;
          renderExpenseTab();
        },
      },
    );
    renderExpenseStats(document.getElementById('expenseStats'), latestExpenses, rates, expensePerPersonView, () => {
      expensePerPersonView = !expensePerPersonView;
      renderExpenseTab();
    });
  };

  let latestChecklistSections = [];
  let latestChecklistItems = [];
  let checklistOrderMigrated = false;
  const checklistEditModeSectionIds = new Set();
  const checklistSelectedItemIds = new Set();
  const renderChecklistTab = () => {
    const needsOrderMigration = latestChecklistSections.some((section) => typeof section.order !== 'number');
    if (needsOrderMigration && !checklistOrderMigrated && latestChecklistSections.length > 0) {
      checklistOrderMigrated = true;
      Promise.all(
        latestChecklistSections.map((section, index) => updateChecklistSection(section.id, { order: index })),
      ).catch((error) => {
        console.error('체크리스트 섹션 순서 마이그레이션 실패', error);
      });
    }
    const sortedSections = needsOrderMigration
      ? latestChecklistSections
      : [...latestChecklistSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const itemsBySectionId = new Map();
    for (const item of latestChecklistItems) {
      const list = itemsBySectionId.get(item.sectionId) || [];
      list.push(item);
      itemsBySectionId.set(item.sectionId, list);
    }
    renderChecklistSections(
      document.getElementById('checklistSectionList'),
      sortedSections,
      itemsBySectionId,
      checklistEditModeSectionIds,
      checklistSelectedItemIds,
      {
        onDeleteSection: async (sectionId) => {
          try {
            const itemsInSection = latestChecklistItems.filter((item) => item.sectionId === sectionId);
            await Promise.all(itemsInSection.map((item) => deleteChecklistItem(item.id)));
            await deleteChecklistSection(sectionId);
          } catch (error) {
            console.error('체크리스트 섹션 삭제 실패', error);
            showFirebaseNotice();
          }
        },
        onAddItem: async (sectionId, title) => {
          try {
            await addChecklistItem(sectionId, title);
          } catch (error) {
            console.error('체크리스트 준비물 추가 실패', error);
            showFirebaseNotice();
          }
        },
        onToggleItem: async (itemId, checked) => {
          try {
            await toggleChecklistItem(itemId, checked);
          } catch (error) {
            console.error('체크리스트 준비물 체크 실패', error);
            showFirebaseNotice();
          }
        },
        onMemoChange: async (itemId, memo) => {
          try {
            await updateChecklistItemMemo(itemId, memo);
          } catch (error) {
            console.error('체크리스트 메모 저장 실패', error);
            showFirebaseNotice();
          }
        },
        onLinkChange: async (itemId, link) => {
          try {
            await updateChecklistItemLink(itemId, link);
          } catch (error) {
            console.error('체크리스트 링크 저장 실패', error);
            showFirebaseNotice();
          }
        },
        onEditSectionTitle: async (sectionId, title) => {
          try {
            await updateChecklistSection(sectionId, { title });
          } catch (error) {
            console.error('체크리스트 섹션 이름 수정 실패', error);
            showFirebaseNotice();
          }
        },
        onEditItemTitle: async (itemId, title) => {
          try {
            await updateChecklistItemTitle(itemId, title);
          } catch (error) {
            console.error('체크리스트 준비물 이름 수정 실패', error);
            showFirebaseNotice();
          }
        },
        onMoveSectionUp: async (sectionId) => {
          const index = sortedSections.findIndex((section) => section.id === sectionId);
          if (index <= 0) return;
          const current = sortedSections[index];
          const neighbor = sortedSections[index - 1];
          try {
            await Promise.all([
              updateChecklistSection(current.id, { order: neighbor.order ?? index - 1 }),
              updateChecklistSection(neighbor.id, { order: current.order ?? index }),
            ]);
          } catch (error) {
            console.error('체크리스트 섹션 순서 변경 실패', error);
            showFirebaseNotice();
          }
        },
        onMoveSectionDown: async (sectionId) => {
          const index = sortedSections.findIndex((section) => section.id === sectionId);
          if (index === -1 || index >= sortedSections.length - 1) return;
          const current = sortedSections[index];
          const neighbor = sortedSections[index + 1];
          try {
            await Promise.all([
              updateChecklistSection(current.id, { order: neighbor.order ?? index + 1 }),
              updateChecklistSection(neighbor.id, { order: current.order ?? index }),
            ]);
          } catch (error) {
            console.error('체크리스트 섹션 순서 변경 실패', error);
            showFirebaseNotice();
          }
        },
        onToggleSectionEditMode: (sectionId) => {
          if (checklistEditModeSectionIds.has(sectionId)) {
            checklistEditModeSectionIds.delete(sectionId);
            latestChecklistItems
              .filter((item) => item.sectionId === sectionId)
              .forEach((item) => checklistSelectedItemIds.delete(item.id));
          } else {
            checklistEditModeSectionIds.add(sectionId);
          }
          renderChecklistTab();
        },
        onToggleItemSelected: (itemId) => {
          if (checklistSelectedItemIds.has(itemId)) {
            checklistSelectedItemIds.delete(itemId);
          } else {
            checklistSelectedItemIds.add(itemId);
          }
          renderChecklistTab();
        },
        onDeleteSelectedItems: async (sectionId) => {
          const idsToDelete = latestChecklistItems
            .filter((item) => item.sectionId === sectionId && checklistSelectedItemIds.has(item.id))
            .map((item) => item.id);
          if (idsToDelete.length === 0) return;
          try {
            await Promise.all(idsToDelete.map((id) => deleteChecklistItem(id)));
            idsToDelete.forEach((id) => checklistSelectedItemIds.delete(id));
          } catch (error) {
            console.error('체크리스트 준비물 일괄 삭제 실패', error);
            showFirebaseNotice();
          }
        },
      },
    );
  };

  let latestMemos = [];
  let memoEditingId = null;
  const renderMemoTab = () => {
    renderMemoList(document.getElementById('memoList'), latestMemos, memoEditingId, {
      onDelete: async (id) => {
        try {
          await deleteMemo(id);
        } catch (error) {
          console.error('메모 삭제 실패', error);
          showFirebaseNotice();
        }
      },
      onSave: async (id, values) => {
        if (!ensureMemoWithinLimit(values)) return;
        try {
          await updateMemo(id, values);
          hideMemoNotice();
          memoEditingId = null;
          renderMemoTab();
        } catch (error) {
          console.error('메모 수정 실패', error);
          showFirebaseNotice();
        }
      },
      onStartEdit: (id) => {
        memoEditingId = id;
        renderMemoTab();
      },
      onCancelEdit: () => {
        memoEditingId = null;
        renderMemoTab();
      },
    });
  };

  let latestBudgetOverridesMap = new Map();
  let latestScheduleOverridesMap = new Map();
  let latestCustomBlocksByDay = new Map();
  let hasRenderedScheduleOnce = false;
  let scheduleEditingBlockId = null;
  const renderScheduleAndSummary = () => {
    const budgetApplied = applyBudgetOverrides(itineraryData, latestBudgetOverridesMap);
    const scheduleApplied = applyScheduleOverrides(budgetApplied, latestScheduleOverridesMap, latestCustomBlocksByDay);
    const effectiveData = applyCustomCostItems(scheduleApplied, groupCustomCostItemsByAnchorKey(latestBudgetOverridesMap));
    latestEffectiveScheduleData = effectiveData;
    const openDayIds = hasRenderedScheduleOnce ? getOpenDayIds(dayListEl) : null;
    renderDayNav(dayNavEl, effectiveData);
    const linkedPlaceCategories = [...PLACE_CATEGORIES, ...latestCustomPlaceCategories.map((c) => c.name)];
    const linkedPlaceRegions = [...tripRegions, ...latestCustomRegions.map((r) => r.name)];
    renderDayList(
      dayListEl,
      effectiveData,
      rates,
      todayDayId,
      handlers,
      openDayIds,
      latestPlaces,
      linkedPlaceCategories,
      linkedPlaceRegions,
      scheduleEditingBlockId,
    );
    hasRenderedScheduleOnce = true;
    plannedTotal = renderBudgetSummary(
      document.getElementById('categoryBreakdown'),
      document.getElementById('plannedTotal'),
      effectiveData,
      rates,
    );
    updateGrandTotal();
    renderExpenseTab();
    renderPlacesTab();
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

  // Firestore 연결 여부와 상관없이 일정/예산 요약은 항상 먼저 보여준다.
  renderScheduleAndSummary();
  renderPlacesTab();
  renderChecklistTab();
  renderMemoTab();

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
      renderScheduleAndSummary();
    }, () => showFirebaseNotice());
    subscribeToExpenses((items) => {
      latestExpenses = items;
      renderExpenseTab();
    }, () => showFirebaseNotice());
    subscribeToChecklistSections((sections) => {
      latestChecklistSections = sections;
      renderChecklistTab();
    }, () => showFirebaseNotice());
    subscribeToChecklistItems((items) => {
      latestChecklistItems = items;
      renderChecklistTab();
    }, () => showFirebaseNotice());
    subscribeToMemos((items) => {
      latestMemos = items;
      renderMemoTab();
    }, () => showFirebaseNotice());
    subscribeToCustomRegions((regions) => {
      latestCustomRegions = regions;
      refreshRegionSelects();
      renderScheduleAndSummary();
    }, () => showFirebaseNotice());
    subscribeToCustomPlaceCategories((categories) => {
      latestCustomPlaceCategories = categories;
      refreshCategorySelects();
      renderScheduleAndSummary();
    }, () => showFirebaseNotice());
  }
}

main();
