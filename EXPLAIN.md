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
- **`js/constants.js`**: 여행 정보, 폴백 환율, Firestore 문서 ID, 카테고리별 아이콘 등 프로젝트 전역 상수. 다른 모든 모듈이 이 파일을 참조한다.
- **`js/data.js`**: `2026 유럽여행.numbers`의 "일정표" 탭을 그대로 옮긴 데이터. 23일치 `day` 배열이며, 각 `day`는 여러 `timeBlock`을 가진다. 비용은 원본 통화 금액(`amount`)만 저장하고 KRW 환산은 저장하지 않는다(환율이 바뀌면 자동으로 다시 계산되어야 하므로).
- **`js/exchangeRate.js`**: 무료 공개 API(`open.er-api.com`)로 실시간 CHF/EUR→KRW 환율을 조회한다. 성공하면 `localStorage`에 6시간 캐시하고, 실패하면 캐시 → `constants.js`의 폴백 값 순서로 대체한다.
- **`js/budgetCalc.js`**: DOM을 건드리지 않는 순수 계산 함수 모음(환산, 1인당 비용, 카테고리별 소계, 총합, 포맷). `render.js`와 `app.js`에서 가져다 쓴다.
- **`js/render.js`**: 실제 화면(DOM)을 그리는 함수들. 날짜 네비게이션, 일정 카드(`<details>` 기반 더보기 토글), 예산 요약, 예산 목록을 담당한다. 계산은 직접 하지 않고 `budgetCalc.js`의 함수를 호출한다.
- **`js/firebaseConfig.js`**: Firebase 프로젝트 연결 설정. 콘솔에서 발급받은 값을 이 파일에 채워 넣어야 한다(README.md 참고).
- **`js/budget.js`**: Firestore와 실제로 통신하는 부분(실시간 구독/추가/삭제). `firebaseConfig.js`가 만든 컬렉션 참조를 사용한다.
- **`js/app.js`**: 위 모듈들을 조립하는 오케스트레이터. 탭 전환, 환율 조회 대기, 초기 렌더링, 예산 폼 이벤트, Firestore 구독을 연결한다. 페이지 로드 시 가장 먼저 실행된다.

## 설계 메모

- **1인당 비용 기준**: 원본 스프레드시트의 "비용(KRW)" 열은 그룹 총액을 인원수로 나눈 1인당 금액이었다. 이 사이트도 동일한 방식을 따르며, 예산 탭의 "예정 비용" 합계는 1인 기준이다.
- **로깅 트레이드오프**: 서버가 없는 정적 프론트엔드라 별도 로깅 라이브러리는 과한 선택이라 판단했다. Firestore/환율 API 호출 실패 시 `console.error`로 최소한의 디버그 정보만 남기고, 사용자에게는 화면 배너로 안내한다.
