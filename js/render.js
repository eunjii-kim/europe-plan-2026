import {
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  SWISS_REGIONS,
  ICONS,
  PLACE_CATEGORY_ICONS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ICONS,
  DEFAULT_EXPENSE_CATEGORY_ICON,
} from './constants.js';
import { perPersonKrw, calcPlannedTotalKrw, groupCostByCategory, calcCustomBudgetTotalKrw, convertToKrw, formatKrw } from './budgetCalc.js';
import {
  calcExpenseTotalKrw,
  groupExpenseByCategory,
  groupExpenseByRegion,
  groupExpenseByCountry,
  UNSPECIFIED_REGION_LABEL,
} from './expenseCalc.js';

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
 * 지역명으로 스위스/이탈리아 구간을 판별해 accent 색상 CSS 변수 이름과 국기 이모지를 반환한다.
 * @param {string} region
 * @returns {{ accentVar: string, bgVar: string, label: string, flag: string }}
 */
function getCountryAccent(region) {
  return SWISS_REGIONS.has(region)
    ? { accentVar: '--swiss-accent', bgVar: '--swiss-accent-bg', label: '스위스', flag: '🇨🇭' }
    : { accentVar: '--italy-accent', bgVar: '--italy-accent-bg', label: '이탈리아', flag: '🇮🇹' };
}

/**
 * 날짜 네비게이션(가로 스크롤 pill 목록)을 렌더링한다. 클릭하면 해당 날짜 카드로 스크롤한다.
 * @param {HTMLElement} navEl
 * @param {Array} itineraryData
 */
export function renderDayNav(navEl, itineraryData) {
  navEl.innerHTML = '';
  for (const day of itineraryData) {
    const { accentVar, flag } = getCountryAccent(day.region);
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'day-pill';
    pill.dataset.dayId = day.id;
    pill.style.setProperty('--pill-accent', `var(${accentVar})`);
    pill.innerHTML = `<span>${day.dateLabel}</span><small>${flag} ${day.region}</small>`;
    pill.addEventListener('click', () => {
      document.getElementById(day.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    navEl.appendChild(pill);
  }
}

/**
 * 날짜 네비게이션에서 현재 스크롤 위치에 해당하는 날짜 pill을 활성 표시한다.
 * @param {HTMLElement} navEl
 * @param {string} dayId
 */
export function setActiveDayPill(navEl, dayId) {
  navEl.querySelectorAll('.day-pill').forEach((pill) => {
    const isActive = pill.dataset.dayId === dayId;
    pill.classList.toggle('is-active', isActive);
    if (isActive) {
      pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });
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
      category: item.category,
      amount: Number(data.get('amount')),
      currency: data.get('currency'),
      headcount: Number(data.get('headcount')) || 1,
    });
  });
  return form;
}

/**
 * 비용이 없던 블록에 새 비용 항목을 추가하는 인라인 폼을 만든다.
 * @param {(values: { category: string, amount: number, currency: string, headcount: number }) => void} onAdd
 * @returns {HTMLElement}
 */
function renderAddCostItemForm(onAdd) {
  const wrapper = document.createElement('div');
  wrapper.className = 'cost-item-add-section';

  const form = document.createElement('form');
  form.className = 'cost-item-edit-form';
  form.hidden = true;
  const categoryOptions = Object.keys(CATEGORY_ICONS)
    .map((category) => `<option value="${category}" ${category === '기타' ? 'selected' : ''}>${CATEGORY_ICONS[category]} ${category}</option>`)
    .join('');
  form.innerHTML = `
    <select name="category" aria-label="분류">${categoryOptions}</select>
    <input type="number" name="amount" placeholder="금액" min="0" step="1" aria-label="금액" required />
    <select name="currency" aria-label="화폐">
      <option value="KRW">KRW</option>
      <option value="EUR">EUR</option>
      <option value="CHF">CHF</option>
    </select>
    <input type="number" name="headcount" value="1" min="1" step="1" aria-label="인원" />
    <button type="submit">추가</button>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    onAdd({
      category: data.get('category'),
      amount: Number(data.get('amount')),
      currency: data.get('currency'),
      headcount: Number(data.get('headcount')) || 1,
    });
    form.reset();
    form.hidden = true;
  });

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'cost-item-add-button';
  toggleButton.textContent = '+ 비용 추가';
  toggleButton.addEventListener('click', () => {
    form.hidden = !form.hidden;
  });

  wrapper.appendChild(toggleButton);
  wrapper.appendChild(form);
  return wrapper;
}

/**
 * 일정 블록의 시간/제목/메모를 수정하는 인라인 폼을 만든다.
 * @param {{ time: string, title: string, note: string }} block
 * @param {(values: { time: string, title: string, note: string }) => void} onSave
 * @returns {HTMLFormElement}
 */
function renderTimeBlockEditForm(block, onSave) {
  const form = document.createElement('form');
  form.className = 'time-block-edit-form';
  form.innerHTML = `
    <input type="text" name="time" value="${escapeHtml(block.time)}" placeholder="시간 (예: 09:00)" aria-label="시간" required />
    <input type="text" name="title" value="${escapeHtml(block.title)}" placeholder="제목" aria-label="제목" required />
    <textarea name="note" placeholder="메모" aria-label="메모">${escapeHtml(block.note || '')}</textarea>
    <button type="submit">저장</button>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    onSave({
      time: data.get('time').trim(),
      title: data.get('title').trim(),
      note: data.get('note').trim(),
    });
  });
  return form;
}

/**
 * 편집모드에서 일정 블록에 붙는 수정/삭제/되돌리기 버튼과 수정 폼을 만든다.
 * @param {object} block
 * @param {object} handlers
 * @returns {{ controls: HTMLElement, form: HTMLFormElement | null }}
 */
function renderTimeBlockEditControls(block, handlers) {
  const controls = document.createElement('div');
  controls.className = 'time-block-edit-controls';

  let form = null;
  if (!block.isCustom) {
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'time-block-icon-button';
    editButton.innerHTML = ICONS.pencil;
    editButton.setAttribute('aria-label', '일정 수정');

    form = renderTimeBlockEditForm(block, (values) => {
      handlers.onEditBlock(block.blockKey, { ...values, attachments: block.attachments || [] });
      form.hidden = true;
    });
    form.hidden = true;
    editButton.addEventListener('click', () => {
      form.hidden = !form.hidden;
    });
    controls.appendChild(editButton);

    if (block.overridden) {
      const restoreButton = document.createElement('button');
      restoreButton.type = 'button';
      restoreButton.className = 'time-block-icon-button';
      restoreButton.innerHTML = ICONS.rotateCcw;
      restoreButton.setAttribute('aria-label', '일정 원래대로');
      restoreButton.addEventListener('click', () => handlers.onRestoreBlock(block.blockKey));
      controls.appendChild(restoreButton);
    }
  }

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'time-block-icon-button time-block-delete-button';
  deleteButton.innerHTML = ICONS.trash;
  deleteButton.setAttribute('aria-label', '일정 삭제');
  deleteButton.addEventListener('click', () => {
    if (!window.confirm('이 일정을 삭제할까요?')) return;
    if (block.isCustom) {
      handlers.onDeleteCustomBlock(block.customId);
    } else {
      handlers.onDeleteBlock(block.blockKey, {
        time: block.time,
        title: block.title,
        note: block.note || '',
        attachments: block.attachments || [],
      });
    }
  });
  controls.appendChild(deleteButton);

  return { controls, form };
}

/**
 * URL에서 표시용 호스트명을 뽑는다. 잘못된 URL이면 원본 문자열을 그대로 쓴다.
 * @param {string} url
 * @returns {string}
 */
function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * 일정 블록의 이미지/링크 첨부 목록과, 편집모드일 때의 첨부 추가 폼을 만든다.
 * @param {{ attachments?: Array<{ type: string, url: string, label?: string }> }} block
 * @param {object} handlers
 * @param {boolean} editMode
 * @returns {HTMLElement}
 */
function renderAttachmentsSection(block, handlers, editMode) {
  const wrapper = document.createElement('div');
  wrapper.className = 'attachment-section';

  const attachments = block.attachments || [];
  if (attachments.length > 0) {
    const list = document.createElement('ul');
    list.className = 'attachment-list';
    attachments.forEach((attachment, index) => {
      const li = document.createElement('li');
      li.className = 'attachment-item';

      if (attachment.type === 'image') {
        const img = document.createElement('img');
        img.className = 'attachment-image';
        img.src = attachment.url;
        img.alt = attachment.label || '첨부 이미지';
        img.loading = 'lazy';
        li.appendChild(img);
      } else {
        const link = document.createElement('a');
        link.className = 'attachment-link-chip';
        link.href = attachment.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = attachment.label || safeHostname(attachment.url);
        li.appendChild(link);
      }

      if (editMode) {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'attachment-remove-button';
        removeButton.innerHTML = ICONS.x;
        removeButton.setAttribute('aria-label', '첨부 삭제');
        removeButton.addEventListener('click', () => handlers.onRemoveAttachment(block, index));
        li.appendChild(removeButton);
      }

      list.appendChild(li);
    });
    wrapper.appendChild(list);
  }

  if (editMode) {
    const form = document.createElement('form');
    form.className = 'attachment-add-form';
    form.innerHTML = `
      <select name="type" aria-label="첨부 종류">
        <option value="image">이미지</option>
        <option value="link">링크</option>
      </select>
      <input type="url" name="url" placeholder="https://..." aria-label="URL" required />
      <input type="text" name="label" placeholder="이름 (선택)" aria-label="이름" />
      <button type="submit">첨부 추가</button>
    `;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const url = data.get('url').trim();
      if (!url) return;
      handlers.onAddAttachment(block, {
        type: data.get('type'),
        url,
        label: data.get('label').trim(),
      });
      form.reset();
    });
    wrapper.appendChild(form);
  }

  return wrapper;
}

/**
 * timeBlock 하나의 DOM 요소를 만든다.
 * @param {object} block
 * @param {{ CHF: number, EUR: number }} rates
 * @param {object} handlers
 * @param {boolean} editMode
 * @returns {HTMLElement}
 */
function renderTimeBlock(block, rates, handlers, editMode) {
  const wrapper = document.createElement('div');
  wrapper.className = 'time-block';

  const mainCostItem = block.costItems?.[0];
  const icon = mainCostItem ? CATEGORY_ICONS[mainCostItem.category] || DEFAULT_CATEGORY_ICON : '';

  const main = document.createElement('div');
  main.className = 'time-block-main';
  main.innerHTML = `
    <span class="time-block-time">${escapeHtml(block.time)}</span>
    <span class="time-block-title${block.overridden ? ' is-overridden' : ''}">${icon ? `${icon} ` : ''}${escapeHtml(block.title)}</span>
    ${mainCostItem ? `<span class="time-block-cost${mainCostItem.overridden ? ' is-overridden' : ''}">${formatCostBadge(mainCostItem, rates)}</span>` : ''}
  `;
  wrapper.appendChild(main);

  if (block.locationTag) {
    const tag = document.createElement('div');
    tag.className = 'location-tag';
    tag.textContent = `📍 ${block.locationTag}`;
    wrapper.insertBefore(tag, main);
  }

  let editForm = null;
  if (editMode) {
    const { controls, form } = renderTimeBlockEditControls(block, handlers);
    editForm = form;
    main.appendChild(controls);
  }

  const hasAttachments = Boolean(block.attachments && block.attachments.length > 0);
  const hasMore = Boolean(block.note) || (block.costItems && block.costItems.length > 0) || hasAttachments || editMode;
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

    if (hasAttachments || editMode) {
      more.appendChild(renderAttachmentsSection(block, handlers, editMode));
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
        if (item.isCustom) {
          const deleteButton = document.createElement('button');
          deleteButton.type = 'button';
          deleteButton.className = 'cost-item-edit-button';
          deleteButton.textContent = '삭제';
          deleteButton.addEventListener('click', () => {
            if (!window.confirm('이 비용 항목을 삭제할까요?')) return;
            handlers.onResetCostItem(item.key);
          });
          buttonGroup.appendChild(deleteButton);
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

    if (editMode) {
      const anchorKey = block.blockKey || block.customId;
      if (anchorKey) {
        more.appendChild(renderAddCostItemForm((values) => handlers.onAddCostItem(anchorKey, values)));
      }
    }

    wrapper.appendChild(more);
  }

  if (editForm) {
    wrapper.appendChild(editForm);
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
 * 편집모드에서 날짜 카드 하단에 붙는 "일정 추가" 버튼과 폼을 만든다.
 * @param {string} dayId
 * @param {(dayId: string, values: { time: string, title: string, note: string }) => void} onAdd
 * @returns {HTMLElement}
 */
function renderAddBlockSection(dayId, onAdd) {
  const wrapper = document.createElement('div');
  wrapper.className = 'add-block-section';

  const form = document.createElement('form');
  form.className = 'add-block-form';
  form.hidden = true;
  form.innerHTML = `
    <input type="text" name="time" placeholder="시간 (예: 09:00)" aria-label="시간" required />
    <input type="text" name="title" placeholder="제목" aria-label="제목" required />
    <textarea name="note" placeholder="메모 (선택)" aria-label="메모"></textarea>
    <button type="submit">추가</button>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    onAdd(dayId, {
      time: data.get('time').trim(),
      title: data.get('title').trim(),
      note: data.get('note').trim(),
    });
    form.reset();
    form.hidden = true;
  });

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'add-block-button';
  toggleButton.textContent = '+ 일정 추가';
  toggleButton.addEventListener('click', () => {
    form.hidden = !form.hidden;
  });

  wrapper.appendChild(toggleButton);
  wrapper.appendChild(form);
  return wrapper;
}

/**
 * 일자별 일정 카드 목록을 렌더링한다.
 * @param {HTMLElement} listEl
 * @param {Array} itineraryData
 * @param {{ CHF: number, EUR: number }} rates
 * @param {string | null} todayDayId - 오늘 날짜와 일치하는 day.id (없으면 null)
 * @param {object} handlers - 비용/일정 편집 관련 핸들러 모음
 * @param {boolean} editMode
 * @param {Set<string> | null} [openDayIds] - 이전 렌더링에서 열려있던 day.id 목록. 주어지면 이 상태를 그대로 복원하고,
 *   없으면(최초 렌더링) todayDayId/첫 번째 카드를 여는 기본 로직을 쓴다.
 */
export function renderDayList(listEl, itineraryData, rates, todayDayId, handlers, editMode, openDayIds = null) {
  listEl.innerHTML = '';
  itineraryData.forEach((day, index) => {
    const { accentVar, bgVar, flag } = getCountryAccent(day.region);
    const card = document.createElement('details');
    card.className = 'day-card';
    card.id = day.id;
    card.style.setProperty('--card-accent', `var(${accentVar})`);
    const shouldOpen = openDayIds
      ? openDayIds.has(day.id)
      : day.id === todayDayId || (!todayDayId && index === 0);
    if (shouldOpen) {
      card.open = true;
    }

    const summary = document.createElement('summary');
    summary.className = 'day-card-summary';
    summary.innerHTML = `<span class="day-date">${day.dateLabel}</span><span class="day-region" style="--region-bg: var(${bgVar}); --region-fg: var(${accentVar});">${flag} ${day.region}</span>`;
    card.appendChild(summary);

    const blockList = document.createElement('div');
    blockList.className = 'time-block-list';
    for (const block of day.timeBlocks) {
      blockList.appendChild(renderTimeBlock(block, rates, handlers, editMode));
    }
    card.appendChild(blockList);

    if (editMode) {
      card.appendChild(renderAddBlockSection(day.id, handlers.onAddBlock));
    }

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
  el.textContent = `환율: 🇨🇭 1 CHF ≈ ${Math.round(rateInfo.CHF).toLocaleString('ko-KR')}원, 🇮🇹 1 EUR ≈ ${Math.round(rateInfo.EUR).toLocaleString('ko-KR')}원 · ${label} (${timeLabel})`;
}

/**
 * 헤더에 D-day 옆에 작게 표시할 환율 요약(출처/시각 라벨 없이 숫자만)을 렌더링한다.
 * @param {HTMLElement} el
 * @param {{ CHF: number, EUR: number }} rateInfo
 */
export function renderRateStatusCompact(el, rateInfo) {
  el.textContent = `🇨🇭 CHF ${Math.round(rateInfo.CHF).toLocaleString('ko-KR')}원 · 🇮🇹 EUR ${Math.round(rateInfo.EUR).toLocaleString('ko-KR')}원`;
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
      <button type="button" class="budget-item-delete" aria-label="삭제">${ICONS.x}</button>
    `;
    li.querySelector('.budget-item-delete').addEventListener('click', () => onDelete(item.id));
    listEl.appendChild(li);
  }
  return calcCustomBudgetTotalKrw(items, rates);
}

/** "정보" 탭 분류 필터에서 전체보기를 나타내는 값 */
export const PLACE_FILTER_ALL = '전체';

/**
 * 정보 탭 카드에서 long-press로 열린 편집/삭제 메뉴 상태. 한 번에 하나만 열려있을 수 있다.
 * @type {{ li: HTMLElement, actionsEl: HTMLElement } | null}
 */
let openPlaceActionsMenu = null;

function closePlaceActionsMenu() {
  if (!openPlaceActionsMenu) return;
  openPlaceActionsMenu.actionsEl.hidden = true;
  openPlaceActionsMenu = null;
}

document.addEventListener('click', (event) => {
  if (!openPlaceActionsMenu) return;
  if (openPlaceActionsMenu.li.contains(event.target)) return;
  closePlaceActionsMenu();
});

/**
 * 정보 탭 카드를 클릭했을 때 장소 정보를 화면 중앙에 확대해서 보여주는 모달의 DOM(지연 생성 싱글턴).
 * @type {{ modal: HTMLElement, category: HTMLElement, favorite: HTMLElement, title: HTMLElement, region: HTMLElement, memo: HTMLElement, link: HTMLAnchorElement, mapLink: HTMLAnchorElement } | null}
 */
let placeDetailModalRefs = null;

function closePlaceDetailModal() {
  if (!placeDetailModalRefs) return;
  placeDetailModalRefs.modal.hidden = true;
}

function ensurePlaceDetailModal() {
  if (placeDetailModalRefs) return placeDetailModalRefs;

  const modal = document.createElement('div');
  modal.className = 'place-detail-modal';
  modal.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'place-detail-backdrop';
  backdrop.addEventListener('click', closePlaceDetailModal);

  const card = document.createElement('div');
  card.className = 'place-detail-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'place-detail-close';
  closeButton.innerHTML = ICONS.x;
  closeButton.setAttribute('aria-label', '닫기');
  closeButton.addEventListener('click', closePlaceDetailModal);

  const header = document.createElement('div');
  header.className = 'place-detail-header';
  const category = document.createElement('span');
  category.className = 'place-detail-category';
  const favorite = document.createElement('span');
  favorite.className = 'place-detail-favorite';
  header.append(category, favorite);

  const title = document.createElement('h3');
  title.className = 'place-detail-title';

  const region = document.createElement('span');
  region.className = 'place-detail-region';

  const memo = document.createElement('p');
  memo.className = 'place-detail-memo';

  const link = document.createElement('a');
  link.className = 'place-detail-link';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const mapLink = document.createElement('a');
  mapLink.className = 'place-detail-map-link';
  mapLink.target = '_blank';
  mapLink.rel = 'noopener noreferrer';
  mapLink.textContent = '🗺️ 지도에서 보기';

  card.append(closeButton, header, title, region, memo, link, mapLink);
  modal.append(backdrop, card);
  document.body.appendChild(modal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePlaceDetailModal();
  });

  placeDetailModalRefs = { modal, category, favorite, title, region, memo, link, mapLink };
  return placeDetailModalRefs;
}

/**
 * 정보 탭 카드 클릭 시 장소 정보를 화면 중앙에 확대해서 보여준다.
 * @param {{ category: string, title: string, region: string, link: string, memo: string, favorite: boolean }} item
 */
function openPlaceDetailModal(item) {
  const refs = ensurePlaceDetailModal();
  const icon = PLACE_CATEGORY_ICONS[item.category];
  refs.category.textContent = icon ? `${icon} ${item.category}` : item.category;
  refs.favorite.innerHTML = item.favorite ? ICONS.starFilled : '';
  refs.title.textContent = item.title;
  refs.region.textContent = item.region ? `📍 ${item.region}` : '';
  refs.region.hidden = !item.region;
  refs.memo.textContent = item.memo || '';
  refs.memo.hidden = !item.memo;
  if (item.link) {
    refs.link.href = item.link;
    refs.link.textContent = `🔗 ${safeHostname(item.link)}`;
    refs.link.hidden = false;
  } else {
    refs.link.hidden = true;
  }
  const mapQuery = [item.title, item.region].filter(Boolean).join(' ');
  refs.mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  refs.modal.hidden = false;
}

/**
 * "정보" 탭의 분류 필터 줄과 지역 필터 줄, 즐겨찾기 토글을 렌더링한다.
 * 각 줄은 label + 가로 스크롤 버튼 목록으로 구성되고 줄바꿈되지 않는다.
 * @param {HTMLElement} containerEl
 * @param {string[]} categories - 고정 분류 + 사용자가 추가한 커스텀 분류 병합 목록
 * @param {string} activeCategory - PLACE_FILTER_ALL 또는 categories 중 하나
 * @param {string[]} regions - 지역 select(아래 입력 폼)와 동일한 지역 목록. 지역 필터 버튼 소스로 재사용된다.
 * @param {string} activeRegion - PLACE_FILTER_ALL, regions 중 하나, 또는 UNSPECIFIED_REGION_LABEL
 * @param {boolean} favoriteOnly - 즐겨찾기만 보기 필터 활성화 여부
 * @param {(category: string) => void} onSelectCategory
 * @param {(region: string) => void} onSelectRegion
 * @param {() => void} onToggleFavorite
 */
export function renderPlaceFilters(
  containerEl,
  categories,
  activeCategory,
  regions,
  activeRegion,
  favoriteOnly,
  onSelectCategory,
  onSelectRegion,
  onToggleFavorite,
) {
  containerEl.innerHTML = '';

  const categoryRow = document.createElement('div');
  categoryRow.className = 'place-filter-row';
  const categoryLabel = document.createElement('span');
  categoryLabel.className = 'place-filter-label';
  categoryLabel.textContent = '분류';
  const categoryScroll = document.createElement('div');
  categoryScroll.className = 'place-filter-scroll';

  const allCategories = [PLACE_FILTER_ALL, ...categories];
  for (const category of allCategories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'place-filter-button';
    button.classList.toggle('is-active', category === activeCategory);
    const icon = category === PLACE_FILTER_ALL ? '' : PLACE_CATEGORY_ICONS[category] || '';
    button.textContent = icon ? `${icon} ${category}` : category;
    button.addEventListener('click', () => onSelectCategory(category));
    categoryScroll.appendChild(button);
  }

  const favoriteButton = document.createElement('button');
  favoriteButton.type = 'button';
  favoriteButton.className = 'place-filter-button place-filter-favorite';
  favoriteButton.classList.toggle('is-active', favoriteOnly);
  favoriteButton.innerHTML = `${favoriteOnly ? ICONS.starFilled : ICONS.star} 즐겨찾기만 보기`;
  favoriteButton.addEventListener('click', () => onToggleFavorite());
  categoryScroll.appendChild(favoriteButton);

  categoryRow.append(categoryLabel, categoryScroll);

  const regionRow = document.createElement('div');
  regionRow.className = 'place-filter-row';
  const regionLabel = document.createElement('span');
  regionLabel.className = 'place-filter-label';
  regionLabel.textContent = '지역';
  const regionScroll = document.createElement('div');
  regionScroll.className = 'place-filter-scroll';

  const allRegions = [PLACE_FILTER_ALL, ...regions, UNSPECIFIED_REGION_LABEL];
  for (const region of allRegions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'place-filter-button';
    button.classList.toggle('is-active', region === activeRegion);
    button.textContent = region === PLACE_FILTER_ALL || region === UNSPECIFIED_REGION_LABEL ? region : `📍 ${region}`;
    button.addEventListener('click', () => onSelectRegion(region));
    regionScroll.appendChild(button);
  }
  regionRow.append(regionLabel, regionScroll);

  containerEl.append(categoryRow, regionRow);
}

/**
 * 저장된 장소 정보를 수정하는 인라인 폼을 만든다.
 * @param {{ category: string, title: string, region: string, link: string, memo: string }} item
 * @param {string[]} categories - 고정 분류 + 사용자가 추가한 커스텀 분류 병합 목록
 * @param {string[]} regions - 지역 select에 채울 옵션 목록
 * @param {(values: { category: string, title: string, region: string, link: string, memo: string }) => void} onSave
 * @returns {HTMLFormElement}
 */
function renderPlaceEditForm(item, categories, regions, onSave) {
  const form = document.createElement('form');
  form.className = 'place-edit-form';
  const categoryOptions = categories
    .map((category) => {
      const icon = PLACE_CATEGORY_ICONS[category] || '';
      const safeCategory = escapeHtml(category);
      const label = icon ? `${icon} ${safeCategory}` : safeCategory;
      return `<option value="${safeCategory}" ${category === item.category ? 'selected' : ''}>${label}</option>`;
    })
    .join('');
  const regionOptions = regions
    .map((region) => `<option value="${escapeHtml(region)}" ${region === item.region ? 'selected' : ''}>${escapeHtml(region)}</option>`)
    .join('');
  form.innerHTML = `
    <select name="category" aria-label="분류">${categoryOptions}</select>
    <input type="text" name="title" value="${escapeHtml(item.title)}" placeholder="이름" aria-label="이름" required />
    <select name="region" aria-label="지역">
      <option value="">지역 선택 안함</option>
      ${regionOptions}
    </select>
    <input type="url" name="link" value="${escapeHtml(item.link || '')}" placeholder="링크" aria-label="링크" />
    <textarea name="memo" placeholder="메모" aria-label="메모" maxlength="200">${escapeHtml(item.memo || '')}</textarea>
    <button type="submit">저장</button>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    onSave({
      category: data.get('category'),
      title: data.get('title').trim(),
      region: data.get('region'),
      link: data.get('link').trim(),
      memo: data.get('memo').trim(),
    });
  });
  return form;
}

/**
 * 조사한 장소(맛집/카페/쇼핑 등) 목록을 렌더링한다.
 * @param {HTMLElement} listEl
 * @param {Array<{ id: string, category: string, title: string, region: string, link: string, memo: string, favorite: boolean }>} items
 * @param {string[]} categories - 고정 분류 + 사용자가 추가한 커스텀 분류 병합 목록
 * @param {string[]} regions - 수정 폼의 지역 select에 채울 옵션 목록
 * @param {(id: string) => void} onDelete
 * @param {(id: string, values: object) => void} onEdit
 * @param {(id: string, favorite: boolean) => void} onToggleFavorite
 */
export function renderPlaceList(listEl, items, categories, regions, onDelete, onEdit, onToggleFavorite) {
  listEl.innerHTML = '';
  closePlaceActionsMenu();
  closePlaceDetailModal();
  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'place-list-empty';
    empty.textContent = '아직 추가한 장소가 없습니다.';
    listEl.appendChild(empty);
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'place-list-item';
    const icon = PLACE_CATEGORY_ICONS[item.category] || '';
    const regionTag = item.region ? `<span class="place-item-region">📍 ${escapeHtml(item.region)}</span>` : '';

    const main = document.createElement('div');
    main.className = 'place-item-main';
    main.innerHTML = `
      <span class="place-item-category">${icon ? `${icon} ` : ''}${escapeHtml(item.category)}</span>
      <span class="place-item-title">${escapeHtml(item.title)}</span>
      ${regionTag}
    `;
    li.appendChild(main);

    if (item.memo) {
      const memo = document.createElement('p');
      memo.className = 'place-item-memo';
      memo.textContent = item.memo;
      li.appendChild(memo);
    }

    if (item.link) {
      const link = document.createElement('a');
      link.className = 'place-item-link';
      link.href = item.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `🔗 ${safeHostname(item.link)}`;
      li.appendChild(link);
    }

    const mapQuery = [item.title, item.region].filter(Boolean).join(' ');
    const mapLink = document.createElement('a');
    mapLink.className = 'place-item-map-link';
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
    mapLink.target = '_blank';
    mapLink.rel = 'noopener noreferrer';
    mapLink.textContent = '🗺️ 지도에서 보기';
    li.appendChild(mapLink);

    const editForm = renderPlaceEditForm(item, categories, regions, (values) => {
      onEdit(item.id, values);
      editForm.hidden = true;
    });
    editForm.hidden = true;

    const favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.className = 'place-item-favorite';
    favoriteButton.classList.toggle('is-active', !!item.favorite);
    favoriteButton.innerHTML = item.favorite ? ICONS.starFilled : ICONS.star;
    favoriteButton.setAttribute('aria-label', item.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가');
    favoriteButton.addEventListener('click', () => onToggleFavorite(item.id, !item.favorite));
    li.appendChild(favoriteButton);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'place-item-actions';
    actionsEl.hidden = true;

    const editActionButton = document.createElement('button');
    editActionButton.type = 'button';
    editActionButton.className = 'place-item-action-edit';
    editActionButton.innerHTML = `${ICONS.pencil} 수정`;
    editActionButton.addEventListener('click', () => {
      closePlaceActionsMenu();
      editForm.hidden = false;
    });

    const deleteActionButton = document.createElement('button');
    deleteActionButton.type = 'button';
    deleteActionButton.className = 'place-item-action-delete';
    deleteActionButton.innerHTML = `${ICONS.trash} 삭제`;
    deleteActionButton.addEventListener('click', () => {
      closePlaceActionsMenu();
      if (!window.confirm(`"${item.title}" 항목을 삭제할까요?`)) return;
      onDelete(item.id);
    });

    actionsEl.append(editActionButton, deleteActionButton);
    li.appendChild(actionsEl);
    li.appendChild(editForm);

    const LONG_PRESS_MS = 500;
    let longPressTimer = null;
    const isInteractiveTarget = (target) => !!target.closest('a, button, input, textarea, select');

    const startLongPress = (event) => {
      if (isInteractiveTarget(event.target)) return;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        closePlaceActionsMenu();
        actionsEl.hidden = false;
        openPlaceActionsMenu = { li, actionsEl };
      }, LONG_PRESS_MS);
    };
    const cancelLongPress = () => {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    };

    li.addEventListener('mousedown', startLongPress);
    li.addEventListener('mouseup', cancelLongPress);
    li.addEventListener('mouseleave', cancelLongPress);
    li.addEventListener('touchstart', startLongPress, { passive: true });
    li.addEventListener('touchmove', cancelLongPress);
    li.addEventListener('touchend', cancelLongPress);
    li.addEventListener('touchcancel', cancelLongPress);
    li.addEventListener('contextmenu', (event) => event.preventDefault());

    li.addEventListener('click', (event) => {
      if (isInteractiveTarget(event.target)) return;
      if (!actionsEl.hidden || !editForm.hidden) return;
      openPlaceDetailModal(item);
    });

    listEl.appendChild(li);
  }
}

/** 국가명별 국기 이모지. resolveCountry()가 반환하는 '미지정'은 매핑에 없으므로 기본 이모지를 쓴다. */
const COUNTRY_FLAGS = { 스위스: '🇨🇭', 이탈리아: '🇮🇹' };
const DEFAULT_COUNTRY_FLAG = '🌍';

/**
 * 지출 기록을 수정하는 인라인 폼을 만든다. 테이블 행(colspan) 안에 통째로 들어간다.
 * @param {{ date: string, category: string, title: string, region: string, amount: number, currency: string, headcount: number }} item
 * @param {string[]} regions - 지역 select에 채울 옵션 목록
 * @param {(values: object) => void} onSave
 * @returns {HTMLFormElement}
 */
function renderExpenseEditForm(item, regions, onSave) {
  const form = document.createElement('form');
  form.className = 'expense-edit-form';
  const categoryOptions = EXPENSE_CATEGORIES
    .map(
      (category) =>
        `<option value="${category}" ${category === item.category ? 'selected' : ''}>${EXPENSE_CATEGORY_ICONS[category]} ${category}</option>`,
    )
    .join('');
  const regionOptions = regions
    .map((region) => `<option value="${escapeHtml(region)}" ${region === item.region ? 'selected' : ''}>${escapeHtml(region)}</option>`)
    .join('');
  form.innerHTML = `
    <input type="date" name="date" value="${escapeHtml(item.date)}" required aria-label="날짜" />
    <select name="category" aria-label="분류">${categoryOptions}</select>
    <select name="region" aria-label="지역">
      <option value="">지역 선택 안함</option>
      ${regionOptions}
    </select>
    <input type="text" name="title" value="${escapeHtml(item.title || '')}" placeholder="항목명 (선택)" aria-label="항목명" maxlength="100" />
    <input type="number" name="amount" value="${item.amount}" placeholder="금액" required min="0" step="1" aria-label="금액" />
    <select name="currency" aria-label="화폐">
      <option value="KRW" ${item.currency === 'KRW' ? 'selected' : ''}>KRW</option>
      <option value="EUR" ${item.currency === 'EUR' ? 'selected' : ''}>EUR</option>
      <option value="CHF" ${item.currency === 'CHF' ? 'selected' : ''}>CHF</option>
    </select>
    <input type="number" name="headcount" value="${item.headcount || 1}" placeholder="1(인원)" min="1" step="1" aria-label="인원" />
    <button type="submit">저장</button>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    onSave({
      date: data.get('date'),
      category: data.get('category'),
      region: data.get('region'),
      title: data.get('title').trim(),
      amount: Number(data.get('amount')),
      currency: data.get('currency'),
      headcount: Number(data.get('headcount')) || 1,
    });
  });
  return form;
}

/**
 * 지출 기록 목록을 테이블로 렌더링한다.
 * @param {HTMLElement} listEl - <table>을 담을 컨테이너(가로 스크롤 래퍼)
 * @param {Array<{ id: string, date: string, category: string, title: string, region: string, amount: number, currency: string, headcount: number }>} items
 * @param {{ CHF: number, EUR: number }} rates
 * @param {(id: string) => void} onDelete
 * @param {(id: string, values: object) => void} onEdit
 * @param {string[]} regions - 수정 폼의 지역 select에 채울 옵션 목록
 */
export function renderExpenseList(listEl, items, rates, onDelete, onEdit, regions) {
  listEl.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'expense-list-empty';
    empty.textContent = '아직 기록한 지출이 없습니다.';
    listEl.appendChild(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'expense-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>날짜</th>
        <th>분류</th>
        <th>항목명</th>
        <th>지역</th>
        <th>금액</th>
        <th>화폐</th>
        <th>인원</th>
        <th>1인당 금액</th>
        <th>수정</th>
        <th>삭제</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');

  for (const item of items) {
    const icon = EXPENSE_CATEGORY_ICONS[item.category] || DEFAULT_EXPENSE_CATEGORY_ICON;
    const krwLabel = item.currency === 'KRW' ? '' : ` (${formatKrw(convertToKrw(item.amount, item.currency, rates))})`;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(item.date)}</td>
      <td>${icon} ${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.title || '')}</td>
      <td>${item.region ? `📍 ${escapeHtml(item.region)}` : ''}</td>
      <td>${item.amount.toLocaleString('ko-KR')}${krwLabel}</td>
      <td>${item.currency}</td>
      <td>${item.headcount || 1}인</td>
      <td>${formatKrw(perPersonKrw(item, rates))}</td>
      <td></td>
      <td></td>
    `;

    const editRow = document.createElement('tr');
    editRow.className = 'expense-edit-row';
    editRow.hidden = true;
    const editRowCell = document.createElement('td');
    editRowCell.colSpan = 10;
    const editForm = renderExpenseEditForm(item, regions, (values) => {
      onEdit(item.id, values);
      editRow.hidden = true;
    });
    editRowCell.appendChild(editForm);
    editRow.appendChild(editRowCell);

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'expense-item-edit';
    editButton.innerHTML = ICONS.pencil;
    editButton.setAttribute('aria-label', '수정');
    editButton.addEventListener('click', () => {
      editRow.hidden = !editRow.hidden;
    });
    row.children[8].appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'expense-item-delete';
    deleteButton.innerHTML = ICONS.x;
    deleteButton.setAttribute('aria-label', '삭제');
    deleteButton.addEventListener('click', () => onDelete(item.id));
    row.children[9].appendChild(deleteButton);

    tbody.appendChild(row);
    tbody.appendChild(editRow);
  }

  table.appendChild(tbody);
  listEl.appendChild(table);
}

/**
 * 소계 배열을 "카테고리 행 + 막대 그래프" 형태로 렌더링하는 공통 섹션을 만든다.
 * @param {string} title - 섹션 제목
 * @param {Array<{ totalKrw: number }>} groups - 라벨 필드(labelKey)와 totalKrw를 가진 배열
 * @param {string} labelKey - groups 각 항목에서 라벨로 쓸 필드명
 * @param {(label: string) => string} resolveIcon - 라벨에 대응하는 아이콘/이모지를 반환
 * @returns {HTMLElement | null} groups가 비어있으면 null
 */
function renderExpenseBreakdownSection(title, groups, labelKey, resolveIcon) {
  if (groups.length === 0) return null;

  const section = document.createElement('div');
  section.className = 'expense-breakdown-section';

  const heading = document.createElement('h3');
  heading.className = 'expense-breakdown-title';
  heading.textContent = title;
  section.appendChild(heading);

  const breakdown = document.createElement('div');
  breakdown.className = 'category-breakdown';
  const maxKrw = groups[0].totalKrw;
  for (const group of groups) {
    const label = group[labelKey];
    const icon = resolveIcon(label);
    const row = document.createElement('div');
    row.className = 'expense-category-row';
    const ratio = maxKrw > 0 ? Math.round((group.totalKrw / maxKrw) * 100) : 0;
    row.innerHTML = `
      <div class="category-row"><span>${icon} ${escapeHtml(label)}</span><span>${formatKrw(group.totalKrw)}</span></div>
      <div class="expense-bar-track"><div class="expense-bar-fill" style="width: ${ratio}%"></div></div>
    `;
    breakdown.appendChild(row);
  }
  section.appendChild(breakdown);
  return section;
}

/**
 * 지출 통계(총합, 카테고리·지역·국가별 소계)를 렌더링한다.
 * el은 <summary>를 담고 있는 <details> 요소이므로, summary는 보존한 채 나머지 내용만 다시 그린다.
 * @param {HTMLElement} el
 * @param {Array<{ category: string, region: string, amount: number, currency: string, headcount: number }>} expenses
 * @param {{ CHF: number, EUR: number }} rates
 * @param {boolean} perPerson - true면 모든 소계를 1인 기준 금액으로 표시
 * @param {() => void} onTogglePerPerson
 */
export function renderExpenseStats(el, expenses, rates, perPerson, onTogglePerPerson) {
  const totalKrw = calcExpenseTotalKrw(expenses, rates, perPerson);

  const summary = el.querySelector('summary');
  el.innerHTML = '';
  if (summary) el.appendChild(summary);

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'expense-per-person-toggle';
  toggleButton.textContent = '1인';
  toggleButton.setAttribute('aria-pressed', String(perPerson));
  toggleButton.addEventListener('click', () => onTogglePerPerson());
  el.appendChild(toggleButton);

  const totalLine = document.createElement('p');
  totalLine.className = 'total-line';
  totalLine.textContent = `총 지출: ${formatKrw(totalKrw)}${perPerson ? ' (1인 기준)' : ''}`;
  el.appendChild(totalLine);

  const categorySection = renderExpenseBreakdownSection(
    '카테고리별',
    groupExpenseByCategory(expenses, rates, perPerson),
    'category',
    (category) => EXPENSE_CATEGORY_ICONS[category] || DEFAULT_EXPENSE_CATEGORY_ICON,
  );
  if (categorySection) el.appendChild(categorySection);

  const countrySection = renderExpenseBreakdownSection(
    '국가별',
    groupExpenseByCountry(expenses, rates, perPerson),
    'country',
    (country) => COUNTRY_FLAGS[country] || DEFAULT_COUNTRY_FLAG,
  );
  if (countrySection) el.appendChild(countrySection);

  const regionSection = renderExpenseBreakdownSection(
    '지역별',
    groupExpenseByRegion(expenses, rates, perPerson),
    'region',
    () => '📍',
  );
  if (regionSection) el.appendChild(regionSection);
}

/**
 * 섹션에 새 준비물을 추가하는 토글 버튼 + 인라인 폼 쌍을 만든다.
 * 버튼은 헤더에, 폼은 섹션 콘텐츠 상단에 각각 배치할 수 있도록 분리해서 반환한다.
 * @param {(title: string) => void} onAdd
 * @returns {{ toggleButton: HTMLButtonElement, form: HTMLFormElement }}
 */
function createChecklistItemAddControls(onAdd) {
  const form = document.createElement('form');
  form.className = 'checklist-item-add-form';
  form.hidden = true;
  form.innerHTML = `
    <input type="text" name="title" placeholder="준비물 이름" maxlength="100" required aria-label="준비물 이름" />
    <button type="submit">추가</button>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const title = data.get('title').trim();
    if (!title) return;
    onAdd(title);
    form.reset();
    form.hidden = true;
  });

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'checklist-item-add-button';
  toggleButton.textContent = '+ 준비물 추가';
  toggleButton.addEventListener('click', () => {
    form.hidden = !form.hidden;
  });

  return { toggleButton, form };
}

/**
 * 섹션 제목을 수정하는 인라인 토글(연필 버튼 + 폼)을 만든다.
 * @param {{ id: string, title: string }} section
 * @param {(sectionId: string, title: string) => void} onEditSectionTitle
 * @returns {{ editButton: HTMLButtonElement, editForm: HTMLFormElement }}
 */
function createChecklistSectionTitleEdit(section, onEditSectionTitle) {
  const editForm = document.createElement('form');
  editForm.className = 'checklist-section-title-edit-form';
  editForm.hidden = true;
  editForm.innerHTML = `
    <input type="text" name="title" value="${escapeHtml(section.title)}" maxlength="50" required aria-label="섹션 이름 수정" />
    <button type="submit">저장</button>
  `;
  editForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(editForm);
    const title = data.get('title').trim();
    if (!title) return;
    onEditSectionTitle(section.id, title);
    editForm.hidden = true;
  });

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'checklist-section-edit';
  editButton.innerHTML = ICONS.pencil;
  editButton.setAttribute('aria-label', '섹션 이름 수정');
  editButton.addEventListener('click', () => {
    editForm.hidden = !editForm.hidden;
  });

  return { editButton, editForm };
}

/**
 * 체크리스트 섹션 목록(섹션별 준비물 포함)을 렌더링한다.
 * @param {HTMLElement} listEl
 * @param {Array<{ id: string, title: string }>} sections - order 기준으로 이미 정렬된 배열
 * @param {Map<string, Array<{ id: string, title: string, checked: boolean, memo: string, link: string }>>} itemsBySectionId
 * @param {Set<string>} editModeSectionIds - 편집모드 중인 섹션 id 집합
 * @param {Set<string>} selectedItemIds - 편집모드에서 삭제 선택된 item id 집합
 * @param {{
 *   onDeleteSection: (sectionId: string) => void,
 *   onAddItem: (sectionId: string, title: string) => void,
 *   onToggleItem: (itemId: string, checked: boolean) => void,
 *   onMemoChange: (itemId: string, memo: string) => void,
 *   onLinkChange: (itemId: string, link: string) => void,
 *   onEditSectionTitle: (sectionId: string, title: string) => void,
 *   onEditItemTitle: (itemId: string, title: string) => void,
 *   onMoveSectionUp: (sectionId: string) => void,
 *   onMoveSectionDown: (sectionId: string) => void,
 *   onToggleSectionEditMode: (sectionId: string) => void,
 *   onToggleItemSelected: (itemId: string) => void,
 *   onDeleteSelectedItems: (sectionId: string) => void,
 * }} handlers
 */
export function renderChecklistSections(listEl, sections, itemsBySectionId, editModeSectionIds, selectedItemIds, handlers) {
  listEl.innerHTML = '';
  if (sections.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'checklist-section-empty';
    empty.textContent = '아직 추가한 섹션이 없습니다.';
    listEl.appendChild(empty);
    return;
  }

  sections.forEach((section, index) => {
    const items = itemsBySectionId.get(section.id) || [];
    const checkedCount = items.filter((item) => item.checked).length;
    const isEditMode = editModeSectionIds.has(section.id);

    const sectionEl = document.createElement('div');
    sectionEl.className = 'checklist-section';

    const header = document.createElement('div');
    header.className = 'checklist-section-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'checklist-section-title-group';
    const titleEl = document.createElement('h3');
    titleEl.className = 'checklist-section-title';
    titleEl.textContent = section.title;
    titleGroup.appendChild(titleEl);

    const { editButton: sectionEditButton, editForm: sectionEditForm } = createChecklistSectionTitleEdit(
      section,
      handlers.onEditSectionTitle,
    );
    titleGroup.appendChild(sectionEditButton);
    header.appendChild(titleGroup);

    const { toggleButton: addItemButton, form: addItemForm } = createChecklistItemAddControls((title) =>
      handlers.onAddItem(section.id, title),
    );

    const actions = document.createElement('div');
    actions.className = 'checklist-section-actions';
    actions.appendChild(addItemButton);

    const progress = document.createElement('span');
    progress.className = 'checklist-section-progress';
    progress.textContent = `${checkedCount}/${items.length}`;
    actions.appendChild(progress);

    const moveButtons = document.createElement('div');
    moveButtons.className = 'checklist-section-move-buttons';

    const moveUpButton = document.createElement('button');
    moveUpButton.type = 'button';
    moveUpButton.className = 'checklist-section-move-up';
    moveUpButton.innerHTML = ICONS.chevronUp;
    moveUpButton.setAttribute('aria-label', '섹션 위로 이동');
    moveUpButton.disabled = index === 0;
    moveUpButton.addEventListener('click', () => handlers.onMoveSectionUp(section.id));
    moveButtons.appendChild(moveUpButton);

    const moveDownButton = document.createElement('button');
    moveDownButton.type = 'button';
    moveDownButton.className = 'checklist-section-move-down';
    moveDownButton.innerHTML = ICONS.chevronDown;
    moveDownButton.setAttribute('aria-label', '섹션 아래로 이동');
    moveDownButton.disabled = index === sections.length - 1;
    moveDownButton.addEventListener('click', () => handlers.onMoveSectionDown(section.id));
    moveButtons.appendChild(moveDownButton);

    actions.appendChild(moveButtons);

    const deleteSectionButton = document.createElement('button');
    deleteSectionButton.type = 'button';
    deleteSectionButton.className = 'checklist-section-delete';
    deleteSectionButton.innerHTML = ICONS.trash;
    deleteSectionButton.setAttribute('aria-label', '섹션 삭제');
    deleteSectionButton.addEventListener('click', () => {
      if (!window.confirm(`"${section.title}" 섹션과 그 안의 준비물을 모두 삭제할까요?`)) return;
      handlers.onDeleteSection(section.id);
    });
    actions.appendChild(deleteSectionButton);

    const editModeToggleButton = document.createElement('button');
    editModeToggleButton.type = 'button';
    editModeToggleButton.className = 'checklist-section-edit-mode-toggle';
    editModeToggleButton.textContent = isEditMode ? '완료' : '편집';
    editModeToggleButton.addEventListener('click', () => handlers.onToggleSectionEditMode(section.id));
    actions.appendChild(editModeToggleButton);

    header.appendChild(actions);
    sectionEl.appendChild(header);
    sectionEl.appendChild(sectionEditForm);
    sectionEl.appendChild(addItemForm);

    if (isEditMode) {
      const selectedCount = items.filter((item) => selectedItemIds.has(item.id)).length;

      const editBar = document.createElement('div');
      editBar.className = 'checklist-edit-bar';

      const selectedCountEl = document.createElement('span');
      selectedCountEl.className = 'checklist-edit-bar-count';
      selectedCountEl.textContent = `${selectedCount}개 선택`;
      editBar.appendChild(selectedCountEl);

      const deleteSelectedButton = document.createElement('button');
      deleteSelectedButton.type = 'button';
      deleteSelectedButton.className = 'checklist-edit-bar-delete';
      deleteSelectedButton.textContent = '선택 삭제';
      deleteSelectedButton.disabled = selectedCount === 0;
      deleteSelectedButton.addEventListener('click', () => {
        if (!window.confirm(`선택한 준비물 ${selectedCount}개를 삭제할까요?`)) return;
        handlers.onDeleteSelectedItems(section.id);
      });
      editBar.appendChild(deleteSelectedButton);

      sectionEl.appendChild(editBar);
    }

    const itemList = document.createElement('ul');
    itemList.className = 'checklist-item-list';
    for (const item of items) {
      const li = document.createElement('li');
      li.className = 'checklist-item';
      li.classList.toggle('is-checked', !!item.checked);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'checklist-item-checkbox';
      if (isEditMode) {
        checkbox.checked = selectedItemIds.has(item.id);
        checkbox.setAttribute('aria-label', `${item.title} 선택`);
        checkbox.addEventListener('change', () => handlers.onToggleItemSelected(item.id));
      } else {
        checkbox.checked = !!item.checked;
        checkbox.setAttribute('aria-label', `${item.title} 완료 체크`);
        checkbox.addEventListener('change', () => handlers.onToggleItem(item.id, checkbox.checked));
      }
      li.appendChild(checkbox);

      if (isEditMode) {
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'checklist-item-title-input';
        titleInput.maxLength = 100;
        titleInput.value = item.title;
        titleInput.setAttribute('aria-label', '준비물 이름 수정');
        titleInput.addEventListener('change', () => {
          const newTitle = titleInput.value.trim();
          if (!newTitle) {
            titleInput.value = item.title;
            return;
          }
          handlers.onEditItemTitle(item.id, newTitle);
        });
        li.appendChild(titleInput);

        const memoInput = document.createElement('input');
        memoInput.type = 'text';
        memoInput.className = 'checklist-item-memo';
        memoInput.placeholder = '메모';
        memoInput.setAttribute('aria-label', `${item.title} 메모`);
        memoInput.value = item.memo || '';
        memoInput.addEventListener('change', () => handlers.onMemoChange(item.id, memoInput.value.trim()));
        li.appendChild(memoInput);

        const linkInput = document.createElement('input');
        linkInput.type = 'url';
        linkInput.className = 'checklist-item-link-input';
        linkInput.placeholder = '링크';
        linkInput.setAttribute('aria-label', `${item.title} 링크`);
        linkInput.value = item.link || '';
        linkInput.addEventListener('change', () => handlers.onLinkChange(item.id, linkInput.value.trim()));
        li.appendChild(linkInput);
      } else {
        const content = document.createElement('div');
        content.className = 'checklist-item-content';

        const titleRow = document.createElement('div');
        titleRow.className = 'checklist-item-title-row';

        const title = document.createElement('span');
        title.className = 'checklist-item-title';
        title.textContent = item.title;
        titleRow.appendChild(title);

        if (item.link) {
          const link = document.createElement('a');
          link.className = 'checklist-item-link';
          link.href = item.link;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = '🔗';
          link.setAttribute('aria-label', `${item.title} 링크 열기`);
          titleRow.appendChild(link);
        }

        content.appendChild(titleRow);

        if (item.memo) {
          const memoText = document.createElement('span');
          memoText.className = 'checklist-item-memo-text';
          memoText.textContent = item.memo;
          content.appendChild(memoText);
        }

        li.appendChild(content);
      }

      itemList.appendChild(li);
    }
    sectionEl.appendChild(itemList);

    listEl.appendChild(sectionEl);
  });
}
