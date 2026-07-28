import {
  FALLBACK_EXCHANGE_RATES,
  EXCHANGE_RATE_API_URL,
  EXCHANGE_RATE_STORAGE_KEY,
  EXCHANGE_RATE_CACHE_TTL_MS,
} from './constants.js';

/**
 * localStorage에 캐시된 환율을 읽는다. 파싱 실패/미존재 시 null.
 * @returns {{ CHF: number, EUR: number, fetchedAt: string } | null}
 */
function readCache() {
  try {
    const raw = localStorage.getItem(EXCHANGE_RATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.CHF !== 'number' || typeof parsed.EUR !== 'number' || !parsed.fetchedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 조회한 환율을 localStorage에 캐시한다. 저장 실패는 무시한다(프라이빗 브라우징 등).
 * @param {{ CHF: number, EUR: number, fetchedAt: string }} rates
 */
function writeCache(rates) {
  try {
    localStorage.setItem(EXCHANGE_RATE_STORAGE_KEY, JSON.stringify(rates));
  } catch {
    // 저장 실패는 기능에 치명적이지 않으므로 무시한다.
  }
}

/**
 * 캐시가 아직 유효한지(TTL 이내인지) 확인한다.
 * @param {{ fetchedAt: string }} cache
 * @returns {boolean}
 */
function isCacheFresh(cache) {
  const fetchedAt = new Date(cache.fetchedAt).getTime();
  return Number.isFinite(fetchedAt) && Date.now() - fetchedAt < EXCHANGE_RATE_CACHE_TTL_MS;
}

/**
 * 무료 공개 API(open.er-api.com)에서 KRW 기준 환율을 조회해
 * "1 CHF/EUR당 KRW" 값으로 변환한다.
 * @returns {Promise<{ CHF: number, EUR: number, fetchedAt: string }>}
 */
async function fetchFromApi() {
  const response = await fetch(EXCHANGE_RATE_API_URL);
  if (!response.ok) {
    throw new Error(`환율 API 응답 오류: ${response.status}`);
  }
  const body = await response.json();
  const krwPerChf = body?.rates?.CHF;
  const krwPerEur = body?.rates?.EUR;
  if (!krwPerChf || !krwPerEur) {
    throw new Error('환율 API 응답에 CHF/EUR 값이 없습니다.');
  }
  return {
    CHF: 1 / krwPerChf,
    EUR: 1 / krwPerEur,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * 현재 사용할 환율을 결정한다. 우선순위: 유효한 캐시 → 실시간 조회 → 만료된 캐시 → 폴백 고정값.
 * @returns {Promise<{ CHF: number, EUR: number, fetchedAt: string | null, source: 'cache' | 'live' | 'fallback' }>}
 */
export async function getExchangeRates() {
  const cached = readCache();
  if (cached && isCacheFresh(cached)) {
    return { ...cached, source: 'cache' };
  }

  try {
    const live = await fetchFromApi();
    writeCache(live);
    return { ...live, source: 'live' };
  } catch (error) {
    console.error('실시간 환율 조회 실패, 대체 값을 사용합니다.', error);
    if (cached) {
      return { ...cached, source: 'cache' };
    }
    return { ...FALLBACK_EXCHANGE_RATES, fetchedAt: null, source: 'fallback' };
  }
}
