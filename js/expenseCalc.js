/**
 * 소비기록(실제 지출) 통계 계산 관련 순수 함수 모음. DOM이나 외부 상태를 건드리지 않는다.
 */
import { convertToKrw, perPersonKrw } from './budgetCalc.js';
import { SWISS_REGIONS } from './constants.js';

/** 지역이 지정되지 않은 지출 기록에 붙이는 라벨 */
export const UNSPECIFIED_REGION_LABEL = '미지정';

/** perPerson이 true면 1인당 KRW, 아니면 총액 KRW를 반환한다. */
function resolveKrw(item, rates, perPerson) {
  return perPerson ? perPersonKrw(item, rates) : convertToKrw(item.amount, item.currency, rates);
}

/**
 * 지역명으로 국가를 판별한다. 일정표의 스위스/이탈리아 구간 판별 기준(SWISS_REGIONS)과 동일하다.
 * @param {string} region
 * @returns {string} '스위스' | '이탈리아' | UNSPECIFIED_REGION_LABEL
 */
export function resolveCountry(region) {
  if (!region) return UNSPECIFIED_REGION_LABEL;
  return SWISS_REGIONS.has(region) ? '스위스' : '이탈리아';
}

/**
 * 지출 기록 목록의 KRW 총합을 계산한다.
 * @param {Array<{ amount: number, currency: string, headcount: number }>} expenses
 * @param {{ CHF: number, EUR: number }} rates
 * @param {boolean} [perPerson] - true면 항목별 1인당 금액을 합산한다.
 * @returns {number}
 */
export function calcExpenseTotalKrw(expenses, rates, perPerson = false) {
  return expenses.reduce((sum, item) => sum + resolveKrw(item, rates, perPerson), 0);
}

/**
 * 지출 기록을 분류별로 묶어 KRW 소계를 계산한다.
 * @param {Array<{ category: string, amount: number, currency: string, headcount: number }>} expenses
 * @param {{ CHF: number, EUR: number }} rates
 * @param {boolean} [perPerson] - true면 항목별 1인당 금액을 합산한다.
 * @returns {Array<{ category: string, totalKrw: number }>} totalKrw 내림차순 정렬
 */
export function groupExpenseByCategory(expenses, rates, perPerson = false) {
  const totals = new Map();
  for (const item of expenses) {
    const prev = totals.get(item.category) || 0;
    totals.set(item.category, prev + resolveKrw(item, rates, perPerson));
  }
  return [...totals.entries()]
    .map(([category, totalKrw]) => ({ category, totalKrw }))
    .sort((a, b) => b.totalKrw - a.totalKrw);
}

/**
 * 지출 기록을 지역별로 묶어 KRW 소계를 계산한다. 지역이 없는 기록은 UNSPECIFIED_REGION_LABEL로 묶인다.
 * @param {Array<{ region: string, amount: number, currency: string, headcount: number }>} expenses
 * @param {{ CHF: number, EUR: number }} rates
 * @param {boolean} [perPerson] - true면 항목별 1인당 금액을 합산한다.
 * @returns {Array<{ region: string, totalKrw: number }>} totalKrw 내림차순 정렬
 */
export function groupExpenseByRegion(expenses, rates, perPerson = false) {
  const totals = new Map();
  for (const item of expenses) {
    const region = item.region || UNSPECIFIED_REGION_LABEL;
    const prev = totals.get(region) || 0;
    totals.set(region, prev + resolveKrw(item, rates, perPerson));
  }
  return [...totals.entries()]
    .map(([region, totalKrw]) => ({ region, totalKrw }))
    .sort((a, b) => b.totalKrw - a.totalKrw);
}

/**
 * 지출 기록을 국가별(스위스/이탈리아/미지정)로 묶어 KRW 소계를 계산한다.
 * @param {Array<{ region: string, amount: number, currency: string, headcount: number }>} expenses
 * @param {{ CHF: number, EUR: number }} rates
 * @param {boolean} [perPerson] - true면 항목별 1인당 금액을 합산한다.
 * @returns {Array<{ country: string, totalKrw: number }>} totalKrw 내림차순 정렬
 */
export function groupExpenseByCountry(expenses, rates, perPerson = false) {
  const totals = new Map();
  for (const item of expenses) {
    const country = resolveCountry(item.region);
    const prev = totals.get(country) || 0;
    totals.set(country, prev + resolveKrw(item, rates, perPerson));
  }
  return [...totals.entries()]
    .map(([country, totalKrw]) => ({ country, totalKrw }))
    .sort((a, b) => b.totalKrw - a.totalKrw);
}
