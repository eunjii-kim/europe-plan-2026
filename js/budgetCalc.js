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
