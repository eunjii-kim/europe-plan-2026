import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, SWISS_REGIONS } from './constants.js';
import { perPersonKrw, calcPlannedTotalKrw, groupCostByCategory, calcCustomBudgetTotalKrw, formatKrw } from './budgetCalc.js';

/**
 * 'YYYY-MM-DD' 문자열을 시간대 이슈 없이 로컬 Date로 변환한다.
 * @param {string} isoDate
 * @returns {Date}
 */
function toLocalDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 오늘 날짜를 기준으로 D-day 문구를 계산한다.
 * @param {{ startDate: string, endDate: string }} tripInfo
 * @param {Date} [today]
 * @returns {string}
 */
export function computeDdayLabel(tripInfo, today = new Date()) {
  const start = toLocalDate(tripInfo.startDate);
  const end = toLocalDate(tripInfo.endDate);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffToStart = Math.round((start - todayMidnight) / msPerDay);

  if (diffToStart > 0) return `D-${diffToStart}`;
  if (todayMidnight <= end) {
    const dayNumber = Math.round((todayMidnight - start) / msPerDay) + 1;
    return `여행 ${dayNumber}일차`;
  }
  return '여행 종료';
}

/**
 * 지역명으로 스위스/이탈리아 구간을 판별해 accent 색상 CSS 변수 이름을 반환한다.
 * @param {string} region
 * @returns {{ accentVar: string, bgVar: string, label: string }}
 */
function getCountryAccent(region) {
  return SWISS_REGIONS.has(region)
    ? { accentVar: '--swiss-accent', bgVar: '--swiss-accent-bg', label: '스위스' }
    : { accentVar: '--italy-accent', bgVar: '--italy-accent-bg', label: '이탈리아' };
}

/**
 * 날짜 네비게이션(가로 스크롤 pill 목록)을 렌더링한다. 클릭하면 해당 날짜 카드로 스크롤한다.
 * @param {HTMLElement} navEl
 * @param {Array} itineraryData
 */
export function renderDayNav(navEl, itineraryData) {
  navEl.innerHTML = '';
  for (const day of itineraryData) {
    const { accentVar } = getCountryAccent(day.region);
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'day-pill';
    pill.style.setProperty('--pill-accent', `var(${accentVar})`);
    pill.innerHTML = `<span>${day.dateLabel}</span><small>${day.region}</small>`;
    pill.addEventListener('click', () => {
      document.getElementById(day.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    navEl.appendChild(pill);
  }
}

/**
 * costItem 하나를 "1인 xxx원" 배지 텍스트로 만든다.
 * @param {{ amount: number, currency: string, headcount: number, category: string }} item
 * @param {{ CHF: number, EUR: number }} rates
 * @returns {string}
 */
function formatCostBadge(item, rates) {
  const krw = perPersonKrw(item, rates);
  const headcountLabel = item.headcount > 1 ? ` (${item.headcount}인 분할)` : '';
  return `${formatKrw(krw)}${headcountLabel}`;
}

/**
 * 비용 항목 하나의 인라인 수정 폼을 만든다.
 * @param {object} item
 * @param {(key: string, values: { amount: number, currency: string, headcount: number }) => void} onEdit
 * @returns {HTMLFormElement}
 */
function renderCostItemEditForm(item, onEdit) {
  const form = document.createElement('form');
  form.className = 'cost-item-edit-form';
  form.innerHTML = `
    <input type="number" name="amount" value="${item.amount}" min="0" step="1" aria-label="금액" />
    <select name="currency" aria-label="화폐">
      <option value="KRW" ${item.currency === 'KRW' ? 'selected' : ''}>KRW</option>
      <option value="EUR" ${item.currency === 'EUR' ? 'selected' : ''}>EUR</option>
      <option value="CHF" ${item.currency === 'CHF' ? 'selected' : ''}>CHF</option>
    </select>
    <input type="number" name="headcount" value="${item.headcount}" min="1" step="1" aria-label="인원" />
    <button type="submit">저장</button>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    onEdit(item.key, {
      amount: Number(data.get('amount')),
      currency: data.get('currency'),
      headcount: Number(data.get('headcount')) || 1,
    });
  });
  return form;
}

/**
 * timeBlock 하나의 DOM 요소를 만든다.
 * @param {object} block
 * @param {{ CHF: number, EUR: number }} rates
 * @param {{ onEditCostItem: Function, onResetCostItem: Function }} handlers
 * @returns {HTMLElement}
 */
function renderTimeBlock(block, rates, handlers) {
  const wrapper = document.createElement('div');
  wrapper.className = 'time-block';

  const mainCostItem = block.costItems?.[0];
  const icon = mainCostItem ? CATEGORY_ICONS[mainCostItem.category] || DEFAULT_CATEGORY_ICON : '';

  const main = document.createElement('div');
  main.className = 'time-block-main';
  main.innerHTML = `
    <span class="time-block-time">${block.time}</span>
    <span class="time-block-title">${icon ? `${icon} ` : ''}${escapeHtml(block.title)}</span>
    ${mainCostItem ? `<span class="time-block-cost${mainCostItem.overridden ? ' is-overridden' : ''}">${formatCostBadge(mainCostItem, rates)}</span>` : ''}
  `;
  wrapper.appendChild(main);

  if (block.locationTag) {
    const tag = document.createElement('div');
    tag.className = 'location-tag';
    tag.textContent = `📍 ${block.locationTag}`;
    wrapper.insertBefore(tag, main);
  }

  const hasMore = Boolean(block.note) || (block.costItems && block.costItems.length > 0);
  if (hasMore) {
    const more = document.createElement('details');
    more.className = 'time-block-more';
    const summary = document.createElement('summary');
    summary.textContent = '더보기';
    more.appendChild(summary);

    if (block.note) {
      const note = document.createElement('p');
      note.className = 'time-block-note';
      note.textContent = block.note;
      more.appendChild(note);
    }

    if (block.costItems && block.costItems.length > 0) {
      const costList = document.createElement('ul');
      costList.className = 'time-block-cost-detail';
      for (const item of block.costItems) {
        const li = document.createElement('li');
        li.className = 'cost-item-row';

        const label = document.createElement('span');
        label.textContent = item.overridden
          ? `${item.category}: 총 ${item.amount.toLocaleString('ko-KR')} ${item.currency} / ${item.headcount}인 (원래 ${item.original.amount.toLocaleString('ko-KR')} ${item.original.currency})`
          : `${item.category}: 총 ${item.amount.toLocaleString('ko-KR')} ${item.currency} / ${item.headcount}인`;
        li.appendChild(label);

        const buttonGroup = document.createElement('span');
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'cost-item-edit-button';
        editButton.textContent = '수정';
        buttonGroup.appendChild(editButton);

        if (item.overridden) {
          const resetButton = document.createElement('button');
          resetButton.type = 'button';
          resetButton.className = 'cost-item-edit-button';
          resetButton.textContent = '원래대로';
          resetButton.addEventListener('click', () => handlers.onResetCostItem(item.key));
          buttonGroup.appendChild(resetButton);
        }
        li.appendChild(buttonGroup);

        const editForm = renderCostItemEditForm(item, handlers.onEditCostItem);
        editForm.hidden = true;
        editButton.addEventListener('click', () => {
          editForm.hidden = !editForm.hidden;
        });

        costList.appendChild(li);
        costList.appendChild(editForm);
      }
      more.appendChild(costList);
    }

    wrapper.appendChild(more);
  }

  return wrapper;
}

/**
 * HTML 특수문자를 이스케이프한다 (사용자 데이터가 아닌 고정 일정 텍스트지만 안전하게 처리).
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 일자별 일정 카드 목록을 렌더링한다.
 * @param {HTMLElement} listEl
 * @param {Array} itineraryData
 * @param {{ CHF: number, EUR: number }} rates
 * @param {string | null} todayDayId - 오늘 날짜와 일치하는 day.id (없으면 null)
 * @param {{ onEditCostItem: Function, onResetCostItem: Function }} handlers
 */
export function renderDayList(listEl, itineraryData, rates, todayDayId, handlers) {
  listEl.innerHTML = '';
  itineraryData.forEach((day, index) => {
    const { accentVar, bgVar } = getCountryAccent(day.region);
    const card = document.createElement('details');
    card.className = 'day-card';
    card.id = day.id;
    card.style.setProperty('--card-accent', `var(${accentVar})`);
    if (day.id === todayDayId || (!todayDayId && index === 0)) {
      card.open = true;
    }

    const summary = document.createElement('summary');
    summary.className = 'day-card-summary';
    summary.innerHTML = `<span class="day-date">${day.dateLabel}</span><span class="day-region" style="--region-bg: var(${bgVar}); --region-fg: var(${accentVar});">${day.region}</span>`;
    card.appendChild(summary);

    const blockList = document.createElement('div');
    blockList.className = 'time-block-list';
    for (const block of day.timeBlocks) {
      blockList.appendChild(renderTimeBlock(block, rates, handlers));
    }
    card.appendChild(blockList);

    listEl.appendChild(card);
  });
}

/**
 * 모든 일정 카드를 펼치거나 접는다.
 * @param {HTMLElement} listEl
 * @param {boolean} open
 */
export function setAllDayCardsOpen(listEl, open) {
  listEl.querySelectorAll('.day-card').forEach((card) => {
    card.open = open;
  });
}

/**
 * 환율 상태 안내(실시간/캐시/폴백)를 렌더링한다.
 * @param {HTMLElement} el
 * @param {{ CHF: number, EUR: number, fetchedAt: string | null, source: string }} rateInfo
 */
export function renderRateStatus(el, rateInfo) {
  const labels = { live: '실시간 조회', cache: '캐시된 값', fallback: '오프라인 기본값' };
  const label = labels[rateInfo.source] || rateInfo.source;
  const timeLabel = rateInfo.fetchedAt
    ? new Date(rateInfo.fetchedAt).toLocaleString('ko-KR')
    : '조회 불가';
  el.textContent = `환율: 1 CHF ≈ ${Math.round(rateInfo.CHF).toLocaleString('ko-KR')}원, 1 EUR ≈ ${Math.round(rateInfo.EUR).toLocaleString('ko-KR')}원 · ${label} (${timeLabel})`;
}

/**
 * 예정 비용(카테고리별 소계 + 총합)을 렌더링한다.
 * @param {HTMLElement} breakdownEl
 * @param {HTMLElement} totalEl
 * @param {Array} itineraryData
 * @param {{ CHF: number, EUR: number }} rates
 * @returns {number} 계산된 1인당 총합 KRW
 */
export function renderBudgetSummary(breakdownEl, totalEl, itineraryData, rates) {
  const groups = groupCostByCategory(itineraryData, rates);
  breakdownEl.innerHTML = '';
  for (const group of groups) {
    const row = document.createElement('div');
    row.className = 'category-row';
    const icon = CATEGORY_ICONS[group.category] || DEFAULT_CATEGORY_ICON;
    row.innerHTML = `<span>${icon} ${group.category}</span><span>${formatKrw(group.totalKrw)}</span>`;
    breakdownEl.appendChild(row);
  }
  const total = calcPlannedTotalKrw(itineraryData, rates);
  totalEl.textContent = `1인 예정 비용 합계: ${formatKrw(total)}`;
  return total;
}

/**
 * 사용자가 추가한 예산 항목 목록을 렌더링한다.
 * @param {HTMLElement} listEl
 * @param {Array<{ id: string, title: string, amount: number, currency: string }>} items
 * @param {{ CHF: number, EUR: number }} rates
 * @param {(id: string) => void} onDelete
 * @returns {number} 계산된 총합 KRW
 */
export function renderBudgetList(listEl, items, rates, onDelete) {
  listEl.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'budget-list-empty';
    empty.textContent = '아직 추가한 예산 항목이 없습니다.';
    listEl.appendChild(empty);
  }
  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'budget-list-item';
    const krwLabel = item.currency === 'KRW' ? '' : ` (${formatKrw(item.amount * (rates[item.currency] || 1))})`;
    li.innerHTML = `
      <span class="budget-item-title">${escapeHtml(item.title)}</span>
      <span class="budget-item-amount">${item.amount.toLocaleString('ko-KR')} ${item.currency}${krwLabel}</span>
      <button type="button" class="budget-item-delete" aria-label="삭제">✕</button>
    `;
    li.querySelector('.budget-item-delete').addEventListener('click', () => onDelete(item.id));
    listEl.appendChild(li);
  }
  return calcCustomBudgetTotalKrw(items, rates);
}
