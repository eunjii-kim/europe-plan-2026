/**
 * 예산 계산 관련 순수 함수 모음. DOM이나 외부 상태를 건드리지 않는다.
 */

/**
 * 주어진 통화 금액을 KRW로 환산한다.
 * @param {number} amount
 * @param {string} currency - 'KRW' | 'CHF' | 'EUR'
 * @param {{ CHF: number, EUR: number }} rates - 1 CHF/EUR당 KRW 환율
 * @returns {number}
 */
export function convertToKrw(amount, currency, rates) {
  if (currency === 'KRW' || !currency) return amount;
  const rate = rates[currency];
  return typeof rate === 'number' ? amount * rate : amount;
}

/**
 * 일정표 비용 항목 하나의 1인당 KRW 비용을 계산한다.
 * 원본 스프레드시트 관례상 amount는 "그룹 총액"이므로 headcount로 나눈다.
 * @param {{ amount: number, currency: string, headcount: number }} costItem
 * @param {{ CHF: number, EUR: number }} rates
 * @returns {number}
 */
export function perPersonKrw(costItem, rates) {
  const totalKrw = convertToKrw(costItem.amount, costItem.currency, rates);
  const headcount = costItem.headcount || 1;
  return totalKrw / headcount;
}

/**
 * 일정 전체(itineraryData)의 1인당 예정 비용 총합을 KRW로 계산한다.
 * @param {Array} itineraryData
 * @param {{ CHF: number, EUR: number }} rates
 * @returns {number}
 */
export function calcPlannedTotalKrw(itineraryData, rates) {
  let total = 0;
  for (const day of itineraryData) {
    for (const block of day.timeBlocks) {
      for (const item of block.costItems || []) {
        total += perPersonKrw(item, rates);
      }
    }
  }
  return total;
}

/**
 * 일정 전체 비용을 카테고리별로 묶어 1인당 KRW 소계를 계산한다.
 * @param {Array} itineraryData
 * @param {{ CHF: number, EUR: number }} rates
 * @returns {Array<{ category: string, totalKrw: number }>} totalKrw 내림차순 정렬
 */
export function groupCostByCategory(itineraryData, rates) {
  const totals = new Map();
  for (const day of itineraryData) {
    for (const block of day.timeBlocks) {
      for (const item of block.costItems || []) {
        const prev = totals.get(item.category) || 0;
        totals.set(item.category, prev + perPersonKrw(item, rates));
      }
    }
  }
  return [...totals.entries()]
    .map(([category, totalKrw]) => ({ category, totalKrw }))
    .sort((a, b) => b.totalKrw - a.totalKrw);
}

/**
 * 사용자가 추가한 예산 항목 목록의 KRW 총합을 계산한다.
 * @param {Array<{ amount: number, currency: string }>} budgetItems
 * @param {{ CHF: number, EUR: number }} rates
 * @returns {number}
 */
export function calcCustomBudgetTotalKrw(budgetItems, rates) {
  return budgetItems.reduce((sum, item) => sum + convertToKrw(item.amount, item.currency, rates), 0);
}

/**
 * KRW 금액을 "1,234,567원" 형태의 문자열로 포맷한다.
 * @param {number} amount
 * @returns {string}
 */
export function formatKrw(amount) {
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

/**
 * 일정 비용 항목 하나를 Firestore 문서 ID로도 쓸 수 있는 고유 키로 변환한다.
 * @param {string} dayId
 * @param {number} blockIndex
 * @param {number} itemIndex
 * @returns {string}
 */
export function buildCostItemKey(dayId, blockIndex, itemIndex) {
  return `${dayId}__${blockIndex}__${itemIndex}`;
}

/**
 * 사용자가 수정한 값(budgetOverrides)을 원본 itineraryData에 덮어씌운 새 배열을 만든다.
 * 각 costItem에는 key와 overridden 플래그가 함께 붙는다.
 * @param {Array} itineraryData
 * @param {Map<string, { amount: number, currency: string, headcount: number }>} overridesMap
 * @returns {Array}
 */
export function applyBudgetOverrides(itineraryData, overridesMap) {
  return itineraryData.map((day) => ({
    ...day,
    timeBlocks: day.timeBlocks.map((block, blockIndex) => ({
      ...block,
      costItems: (block.costItems || []).map((item, itemIndex) => {
        const key = buildCostItemKey(day.id, blockIndex, itemIndex);
        const override = overridesMap.get(key);
        return override
          ? { ...item, ...override, key, overridden: true, original: item }
          : { ...item, key, overridden: false };
      }),
    })),
  }));
}

/** 사용자가 새로 추가한 비용 항목의 키에서 anchorKey와 구분해주는 표시자 */
const CUSTOM_COST_ITEM_MARKER = '__custom__';

/**
 * 블록의 anchorKey(원본 블록은 blockKey, 사용자가 추가한 블록은 customId)로부터
 * 새 비용 항목의 키 접두사를 만든다.
 * @param {string} anchorKey
 * @returns {string}
 */
export function buildCustomCostItemKeyPrefix(anchorKey) {
  return `${anchorKey}${CUSTOM_COST_ITEM_MARKER}`;
}

/**
 * overridesMap에서 "원본에 없던, 사용자가 새로 추가한" 비용 항목만 뽑아 anchorKey별로 묶는다.
 * @param {Map<string, { category: string, amount: number, currency: string, headcount: number }>} overridesMap
 * @returns {Map<string, Array>}
 */
export function groupCustomCostItemsByAnchorKey(overridesMap) {
  const grouped = new Map();
  for (const [key, value] of overridesMap) {
    const markerIndex = key.indexOf(CUSTOM_COST_ITEM_MARKER);
    if (markerIndex === -1) continue;
    const anchorKey = key.slice(0, markerIndex);
    const list = grouped.get(anchorKey) || [];
    list.push({ ...value, key, isCustom: true, overridden: false });
    grouped.set(anchorKey, list);
  }
  return grouped;
}

/**
 * 원본 블록(blockKey)과 사용자가 추가한 블록(customId) 구분 없이, anchorKey 기준으로
 * 사용자가 새로 추가한 비용 항목을 costItems 뒤에 덧붙인다.
 * @param {Array} itineraryData - applyScheduleOverrides까지 적용되어 blockKey/customId가 부여된 데이터
 * @param {Map<string, Array>} customCostItemsMap - groupCustomCostItemsByAnchorKey의 결과
 * @returns {Array}
 */
export function applyCustomCostItems(itineraryData, customCostItemsMap) {
  return itineraryData.map((day) => ({
    ...day,
    timeBlocks: day.timeBlocks.map((block) => {
      const anchorKey = block.blockKey || block.customId;
      const extraItems = anchorKey ? customCostItemsMap.get(anchorKey) : undefined;
      return extraItems ? { ...block, costItems: [...(block.costItems || []), ...extraItems] } : block;
    }),
  }));
}
