# 파일 연결 구조 설명

이 문서는 `2026 유럽여행` 웹사이트를 구성하는 각 파일이 서로 어떻게 연결되어 동작하는지 설명한다. 빌드 도구 없이 순수 HTML/CSS/JS(ES 모듈)로 작성되어 있다.

## 전체 흐름

```
index.html
  └─ css/style.css        (스타일)
  └─ js/app.js             (엔트리포인트, <script type="module">로 로드)
       ├─ js/constants.js       (상수)
       ├─ js/data.js            (일정 원본 데이터)
       ├─ js/exchangeRate.js    (실시간 환율 조회)
       │    └─ js/constants.js
       ├─ js/budgetCalc.js      (예산 계산 순수 함수)
       ├─ js/render.js          (DOM 렌더링)
       │    ├─ js/constants.js
       │    └─ js/budgetCalc.js
       ├─ js/budget.js          (Firestore CRUD)
       │    └─ js/firebaseConfig.js
       └─ js/firebaseConfig.js  (Firebase 초기화)
            └─ js/constants.js
```

## 파일별 역할

- **`index.html`**: 페이지의 뼈대. 헤더(제목/D-day), 탭(일정/예산) 컨테이너, 각 영역의 빈 껍데기 요소(`id`로 식별)만 담고 있다. 실제 내용은 `app.js`가 실행되며 채운다.
- **`css/style.css`**: 색상·간격 등은 CSS 커스텀 프로퍼티(`:root`)로 정의해 매직넘버 없이 관리한다. 모바일 우선으로 작성되었고 `prefers-color-scheme`로 다크모드도 지원한다.
- **`js/constants.js`**: 여행 정보, 폴백 환율, Firestore 문서 ID, 카테고리별 아이콘, 스위스 지역 목록(`SWISS_REGIONS`), 테마 저장 키 등 프로젝트 전역 상수. 다른 모든 모듈이 이 파일을 참조한다.
- **`js/data.js`**: `2026 유럽여행.numbers`의 "일정표" 탭을 그대로 옮긴 데이터. 23일치 `day` 배열이며, 각 `day`는 여러 `timeBlock`을 가진다. 비용은 원본 통화 금액(`amount`)만 저장하고 KRW 환산은 저장하지 않는다(환율이 바뀌면 자동으로 다시 계산되어야 하므로).
- **`js/exchangeRate.js`**: 무료 공개 API(`open.er-api.com`)로 실시간 CHF/EUR→KRW 환율을 조회한다. 성공하면 `localStorage`에 6시간 캐시하고, 실패하면 캐시 → `constants.js`의 폴백 값 순서로 대체한다.
- **`js/budgetCalc.js`**: DOM을 건드리지 않는 순수 계산 함수 모음(환산, 1인당 비용, 카테고리별 소계, 총합, 포맷). `applyBudgetOverrides`는 Firestore에서 받아온 수정값(overridesMap)을 `data.js`의 원본 데이터에 덮어씌운 새 배열을 만든다(원본은 변경하지 않음). `render.js`와 `app.js`에서 가져다 쓴다.
- **`js/render.js`**: 실제 화면(DOM)을 그리는 함수들. 날짜 네비게이션, 일정 카드(`<details>` 기반 더보기 토글), 비용 항목 인라인 수정 폼, 예산 요약, 예산 목록을 담당한다. 지역명이 `SWISS_REGIONS`에 있는지로 스위스/이탈리아 accent 색상(CSS 변수)을 결정한다. 계산은 직접 하지 않고 `budgetCalc.js`의 함수를 호출한다.
- **`js/firebaseConfig.js`**: Firebase 프로젝트(`europe-plan-2026`) 연결 설정과 `budgetItemsCollection`/`budgetOverridesCollection` 참조를 내보낸다.
- **`js/budget.js`**: Firestore와 실제로 통신하는 부분. 사용자가 추가한 예산 항목(`budgetItems`)과 기존 일정 비용 수정값(`budgetOverrides`) 두 서브컬렉션 모두 실시간 구독/추가·수정/삭제 함수를 제공한다.
- **`js/app.js`**: 위 모듈들을 조립하는 오케스트레이터. 탭 전환, 라이트/다크 테마 토글, 모두 펼치기/접기, 환율 조회 대기, 초기 렌더링, 예산 폼 이벤트, Firestore 구독(예산 항목 + 비용 수정값)을 연결한다. 페이지 로드 시 가장 먼저 실행된다.

## 설계 메모

- **1인당 비용 기준**: 원본 스프레드시트의 "비용(KRW)" 열은 그룹 총액을 인원수로 나눈 1인당 금액이었다. 이 사이트도 동일한 방식을 따르며, 예산 탭의 "예정 비용" 합계는 1인 기준이다.
- **비용 항목 수정 방식**: `data.js`의 원본 데이터는 절대 수정하지 않는다. 대신 Firestore `budgetOverrides` 컬렉션에 `{day.id}__{blockIndex}__{itemIndex}` 키로 수정값을 저장하고, 화면에 그릴 때마다 `applyBudgetOverrides`로 원본 위에 덮어씌운다. "원래대로" 버튼은 이 override 문서를 삭제해 원본으로 되돌린다.
- **테마**: 기본은 `prefers-color-scheme`를 따르고, 헤더의 토글 버튼을 누르면 `<html data-theme="light|dark">`로 명시적으로 고정하며 `localStorage`에 저장해 다음 방문에도 유지한다. 색상 값은 shadcn/ui의 기본 Neutral 테마(oklch)를 그대로 사용했다.
- **로깅 트레이드오프**: 서버가 없는 정적 프론트엔드라 별도 로깅 라이브러리는 과한 선택이라 판단했다. Firestore/환율 API 호출 실패 시 `console.error`로 최소한의 디버그 정보만 남기고, 사용자에게는 화면 배너로 안내한다.
