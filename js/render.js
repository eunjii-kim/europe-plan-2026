import {
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  SWISS_REGIONS,
  ICONS,
  PLACE_CATEGORIES,
  PLACE_CATEGORY_ICONS,
  DEFAULT_PLACE_CATEGORY_ICON,
  EXPENSE_CATEGORY_ICONS,
  DEFAULT_EXPENSE_CATEGORY_ICON,
} from './constants.js';
import { perPersonKrw, calcPlannedTotalKrw, groupCostByCategory, calcCustomBudgetTotalKrw, convertToKrw, formatKrw } from './budgetCalc.js';
import { calcExpenseTotalKrw, groupExpenseByCategory, groupExpenseByRegion, groupExpenseByCountry } from './expenseCalc.js';

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
 * "정보" 탭의 분류 필터 버튼(전체 + 분류별)을 렌더링한다.
 * @param {HTMLElement} containerEl
 * @param {string} activeCategory - PLACE_FILTER_ALL 또는 PLACE_CATEGORIES 중 하나
 * @param {(category: string) => void} onSelect
 */
export function renderPlaceFilters(containerEl, activeCategory, onSelect) {
  containerEl.innerHTML = '';
  const categories = [PLACE_FILTER_ALL, ...PLACE_CATEGORIES];
  for (const category of categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'place-filter-button';
    button.classList.toggle('is-active', category === activeCategory);
    const icon = category === PLACE_FILTER_ALL ? '' : `${PLACE_CATEGORY_ICONS[category]} `;
    button.textContent = `${icon}${category}`;
    button.addEventListener('click', () => onSelect(category));
    containerEl.appendChild(button);
  }
}

/**
 * 저장된 장소 정보를 수정하는 인라인 폼을 만든다.
 * @param {{ category: string, title: string, region: string, link: string, memo: string }} item
 * @param {string[]} regions - 지역 select에 채울 옵션 목록
 * @param {(values: { category: string, title: string, region: string, link: string, memo: string }) => void} onSave
 * @returns {HTMLFormElement}
 */
function renderPlaceEditForm(item, regions, onSave) {
  const form = document.createElement('form');
  form.className = 'place-edit-form';
  const categoryOptions = PLACE_CATEGORIES
    .map((category) => `<option value="${category}" ${category === item.category ? 'selected' : ''}>${PLACE_CATEGORY_ICONS[category]} ${category}</option>`)
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
 * @param {Array<{ id: string, category: string, title: string, region: string, link: string, memo: string }>} items
 * @param {string[]} regions - 수정 폼의 지역 select에 채울 옵션 목록
 * @param {(id: string) => void} onDelete
 * @param {(id: string, values: object) => void} onEdit
 */
export function renderPlaceList(listEl, items, regions, onDelete, onEdit) {
  listEl.innerHTML = '';
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
    const icon = PLACE_CATEGORY_ICONS[item.category] || DEFAULT_PLACE_CATEGORY_ICON;
    const regionTag = item.region ? `<span class="place-item-region">📍 ${escapeHtml(item.region)}</span>` : '';

    const main = document.createElement('div');
    main.className = 'place-item-main';
    main.innerHTML = `
      <span class="place-item-category">${icon} ${escapeHtml(item.category)}</span>
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

    const editForm = renderPlaceEditForm(item, regions, (values) => {
      onEdit(item.id, values);
      editForm.hidden = true;
    });
    editForm.hidden = true;

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'place-item-edit';
    editButton.innerHTML = ICONS.pencil;
    editButton.setAttribute('aria-label', '수정');
    editButton.addEventListener('click', () => {
      editForm.hidden = !editForm.hidden;
    });
    li.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'place-item-delete';
    deleteButton.innerHTML = ICONS.x;
    deleteButton.setAttribute('aria-label', '삭제');
    deleteButton.addEventListener('click', () => onDelete(item.id));
    li.appendChild(deleteButton);

    li.appendChild(editForm);

    listEl.appendChild(li);
  }
}

/** 국가명별 국기 이모지. resolveCountry()가 반환하는 '미지정'은 매핑에 없으므로 기본 이모지를 쓴다. */
const COUNTRY_FLAGS = { 스위스: '🇨🇭', 이탈리아: '🇮🇹' };
const DEFAULT_COUNTRY_FLAG = '🌍';

/**
 * 지출 기록 목록을 렌더링한다.
 * @param {HTMLElement} listEl
 * @param {Array<{ id: string, date: string, category: string, title: string, region: string, amount: number, currency: string }>} items
 * @param {{ CHF: number, EUR: number }} rates
 * @param {(id: string) => void} onDelete
 */
export function renderExpenseList(listEl, items, rates, onDelete) {
  listEl.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'expense-list-empty';
    empty.textContent = '아직 기록한 지출이 없습니다.';
    listEl.appendChild(empty);
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'expense-list-item';
    const icon = EXPENSE_CATEGORY_ICONS[item.category] || DEFAULT_EXPENSE_CATEGORY_ICON;
    const krwLabel = item.currency === 'KRW' ? '' : ` (${formatKrw(convertToKrw(item.amount, item.currency, rates))})`;
    const regionTag = item.region ? `<span class="expense-item-region">📍 ${escapeHtml(item.region)}</span>` : '';
    li.innerHTML = `
      <span class="expense-item-date">${escapeHtml(item.date)}</span>
      <span class="expense-item-category">${icon} ${escapeHtml(item.category)}</span>
      <span class="expense-item-title">${escapeHtml(item.title || '')}</span>
      ${regionTag}
      <span class="expense-item-amount">${item.amount.toLocaleString('ko-KR')} ${item.currency}${krwLabel}</span>
      <button type="button" class="expense-item-delete" aria-label="삭제">${ICONS.x}</button>
    `;
    li.querySelector('.expense-item-delete').addEventListener('click', () => onDelete(item.id));
    listEl.appendChild(li);
  }
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
 * 지출 통계(총합, 카테고리·지역·국가별 소계, 예산 대비 잔액)를 렌더링한다.
 * @param {HTMLElement} el
 * @param {Array<{ category: string, region: string, amount: number, currency: string }>} expenses
 * @param {{ CHF: number, EUR: number }} rates
 * @param {number} plannedTotalKrw - 예산 탭에서 계산된 1인 예정 비용 총합(KRW)
 */
export function renderExpenseStats(el, expenses, rates, plannedTotalKrw) {
  const totalKrw = calcExpenseTotalKrw(expenses, rates);
  const remainingKrw = plannedTotalKrw - totalKrw;

  el.innerHTML = '';

  const totalLine = document.createElement('p');
  totalLine.className = 'total-line';
  totalLine.textContent = `총 지출: ${formatKrw(totalKrw)}`;
  el.appendChild(totalLine);

  const categorySection = renderExpenseBreakdownSection(
    '카테고리별',
    groupExpenseByCategory(expenses, rates),
    'category',
    (category) => EXPENSE_CATEGORY_ICONS[category] || DEFAULT_EXPENSE_CATEGORY_ICON,
  );
  if (categorySection) el.appendChild(categorySection);

  const countrySection = renderExpenseBreakdownSection(
    '국가별',
    groupExpenseByCountry(expenses, rates),
    'country',
    (country) => COUNTRY_FLAGS[country] || DEFAULT_COUNTRY_FLAG,
  );
  if (countrySection) el.appendChild(countrySection);

  const regionSection = renderExpenseBreakdownSection(
    '지역별',
    groupExpenseByRegion(expenses, rates),
    'region',
    () => '📍',
  );
  if (regionSection) el.appendChild(regionSection);

  const remainingLine = document.createElement('p');
  remainingLine.className = `total-line expense-remaining-line${remainingKrw < 0 ? ' is-over' : ''}`;
  remainingLine.textContent =
    remainingKrw >= 0 ? `예정 비용 대비 남은 예산: ${formatKrw(remainingKrw)}` : `예정 비용 초과: ${formatKrw(-remainingKrw)}`;
  el.appendChild(remainingLine);
}
