/**
 * 프로젝트 전역에서 쓰는 상수 모음. 매직넘버를 여기 한 곳에 모아 관리한다.
 */

export const TRIP_INFO = {
  title: '2026 유럽여행',
  regionLabel: '스위스 · 이탈리아',
  startDate: '2026-09-26',
  endDate: '2026-10-18',
};

/** Firestore에서 이 여행 데이터를 구분하는 문서 ID */
export const TRIP_ID = 'europe-plan-2026';

/**
 * 실시간 환율 조회가 실패했을 때 사용하는 폴백 환율.
 * "2026 유럽여행.numbers" 원본 일정표에 기록되어 있던 값이다.
 */
export const FALLBACK_EXCHANGE_RATES = {
  CHF: 1850,
  EUR: 1710,
};

/** 실시간 환율 캐시 유효 시간(밀리초). 6시간. */
export const EXCHANGE_RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** 실시간 환율 조회용 무료 공개 API (키 불필요, KRW 기준 환율표 반환) */
export const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/KRW';

/** localStorage에 환율 캐시를 저장할 때 쓰는 키 */
export const EXCHANGE_RATE_STORAGE_KEY = 'europePlan2026:exchangeRateCache';

/** 항목(카테고리)별로 붙일 이모지 아이콘. 매핑에 없는 카테고리는 DEFAULT_CATEGORY_ICON을 쓴다. */
export const CATEGORY_ICONS = {
  비행기: '✈️',
  기차: '🚄',
  '기차(왕복)': '🚄',
  '기차&푸니쿨라': '🚋',
  숙소: '🏨',
  투어: '🎫',
  입장료: '🎟️',
  '미술관 입장료': '🖼️',
  '콜로세움 통합권': '🏛️',
  식사: '🍽️',
  '수신기 대여': '🎧',
  물품보관함: '🧳',
  해안도로: '🚌',
  카프리섬: '🚤',
  기타: '💰',
};

export const DEFAULT_CATEGORY_ICON = '💰';

/** 스위스 구간에 해당하는 지역명. 이 목록에 없는 지역은 이탈리아 구간으로 간주한다. */
export const SWISS_REGIONS = new Set(['인터라켄', '그린델발트', '융프라우', '체르마트']);

/** localStorage에 라이트/다크 테마 선택값을 저장할 때 쓰는 키 */
export const THEME_STORAGE_KEY = 'europePlan2026:theme';
