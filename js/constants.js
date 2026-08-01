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

/** 실시간 환율 캐시 유효 시간(밀리초). 1시간. */
export const EXCHANGE_RATE_CACHE_TTL_MS = 60 * 60 * 1000;

/** 헤더 환율 표시 자동 갱신 주기(밀리초). 1시간. */
export const EXCHANGE_RATE_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

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

/** "정보" 탭에서 쓰는 장소 분류 목록 */
export const PLACE_CATEGORIES = ['맛집', '카페', '쇼핑', '기타'];

/** 장소 분류별 아이콘 */
export const PLACE_CATEGORY_ICONS = {
  맛집: '🍴',
  카페: '☕',
  쇼핑: '🛍️',
  기타: '📌',
};

export const DEFAULT_PLACE_CATEGORY_ICON = '📌';

/** "소비기록" 탭에서 쓰는 지출 분류 목록 */
export const EXPENSE_CATEGORIES = ['식비', '교통', '숙소', '쇼핑', '입장료/투어', '기타'];

/** 지출 분류별 아이콘 */
export const EXPENSE_CATEGORY_ICONS = {
  식비: '🍽️',
  교통: '🚄',
  숙소: '🏨',
  쇼핑: '🛍️',
  '입장료/투어': '🎟️',
  기타: '💰',
};

export const DEFAULT_EXPENSE_CATEGORY_ICON = '💰';

/** 스위스 구간에 해당하는 지역명. 이 목록에 없는 지역은 이탈리아 구간으로 간주한다. */
export const SWISS_REGIONS = new Set(['인터라켄', '그린델발트', '융프라우', '체르마트']);

/**
 * 정보/소비기록 탭의 지역 select에서 제외할 지역명.
 * 일정표(day.region)에는 남아있지만, 장소/지출을 기록할 지역 선택지로는 부적절해 숨긴다.
 */
export const EXCLUDED_REGIONS = new Set(['남부투어', '자유일정', '로마 → 인천']);

/** 지역 select 맨 아래 "+ 새 지역 추가" 옵션에 쓰는 sentinel value */
export const ADD_NEW_REGION_VALUE = '__add_new_region__';

/** localStorage에 라이트/다크 테마 선택값을 저장할 때 쓰는 키 */
export const THEME_STORAGE_KEY = 'europePlan2026:theme';

/** localStorage에 편집모드 on/off 상태를 저장할 때 쓰는 키 */
export const EDIT_MODE_STORAGE_KEY = 'europePlan2026:editMode';

/**
 * shadcn/ui가 쓰는 lucide 아이콘과 동일한 선형(outline) 스타일의 SVG 아이콘 모음.
 * stroke="currentColor"라 버튼의 color 값을 그대로 물려받는다. 편집/삭제/토글 등
 * 기능성 UI 아이콘에만 쓰고, 카테고리 이모지(CATEGORY_ICONS)나 국기 등
 * 콘텐츠성 이모지는 그대로 유지한다.
 */
export const ICONS = {
  pencil:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
  trash:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
  rotateCcw:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  sun: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  moon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  wrench:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  star:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>',
  starFilled:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>',
  chevronUp:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  chevronDown:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
};
