# 2026 유럽여행 일정 웹사이트

스위스·이탈리아 2026년 유럽여행(9/26~10/18) 일정표를 웹에서 보기 편하게 정리하고, 필요한 예산을 여러 기기에서 함께 관리할 수 있는 사이트입니다.

**주요 기능**
- 날짜별 일정 카드(더보기로 상세 메모 확인), 모두 펼치기/모두 접기
- 스위스 구간(인터라켄·그린델발트·융프라우·체르마트)과 이탈리아 구간을 다른 색상으로 구분 표시
- CHF/EUR 실시간 환율 조회(헤더 + 예산 탭에 상시 표시), 실패 시 원본 환율로 자동 대체
- 원래 일정표 비용 항목을 직접 수정/원상복구 가능 (기기 간 실시간 공유)
- 추가 필요 예산 입력 (기기 간 실시간 공유)
- 라이트/다크 모드 토글

## 로컬에서 실행하기

ES 모듈(`import`/`export`)을 쓰기 때문에 `file://`로 직접 열면 CORS 오류가 납니다. 반드시 간단한 정적 서버로 실행하세요.

```bash
cd "europe-plan-2026"
python3 -m http.server 8000
```

그 후 브라우저에서 `http://localhost:8000` 접속.

## 1. Firebase 설정 (완료됨)

`europe-plan-2026` Firebase 프로젝트가 이미 생성되어 있고 `js/firebaseConfig.js`에 설정값이 채워져 있습니다. Firestore는 서울 리전(asia-northeast3)에 프로덕션 모드로 생성되어 있으며, 아래 두 서브컬렉션만 열려 있는 보안 규칙이 게시되어 있습니다.

- `trips/europe-plan-2026/budgetItems` — 사용자가 예산 탭에서 직접 추가한 항목
- `trips/europe-plan-2026/budgetOverrides` — 원래 일정표 비용 항목을 수정한 값 (일정 탭의 "수정" 버튼으로 생성)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/europe-plan-2026/budgetItems/{itemId} {
      allow read: if true;
      allow create, update: if request.resource.data.title is string
                    && request.resource.data.title.size() <= 100
                    && request.resource.data.amount is number
                    && request.resource.data.amount >= 0
                    && request.resource.data.amount <= 100000000;
      allow delete: if true;
    }
    match /trips/europe-plan-2026/budgetOverrides/{itemId} {
      allow read: if true;
      allow create, update: if request.resource.data.amount is number
                    && request.resource.data.amount >= 0
                    && request.resource.data.amount <= 100000000
                    && request.resource.data.currency in ['KRW', 'EUR', 'CHF']
                    && request.resource.data.headcount is number
                    && request.resource.data.headcount >= 1
                    && request.resource.data.headcount <= 20;
      allow delete: if true;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> `firebaseConfig.js`의 값들은 비밀키가 아니라 클라이언트 식별용 공개 설정값이라 깃허브에 올려도 안전합니다. 실제 접근 제어는 위 Firestore 규칙이 담당합니다. 다만 로그인 없이 누구나 쓰기가 가능한 구조이므로, 더 강한 보안이 필요하면 Firebase Anonymous Auth 도입을 고려하세요.

### 다른 Firebase 프로젝트로 새로 연결하고 싶다면

1. [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트를 만듭니다.
2. 왼쪽 메뉴에서 **Firestore Database** → "데이터베이스 만들기" → 리전은 `asia-northeast3 (서울)` 선택 → 프로덕션 모드로 시작.
3. 좌측 상단 톱니바퀴(프로젝트 설정) → "내 앱" → 웹 아이콘(`</>`)으로 웹 앱 등록.
4. 등록 후 나오는 `firebaseConfig` 값을 `js/firebaseConfig.js`에 붙여넣습니다.
5. Firestore "규칙" 탭에서 위 규칙을 붙여넣고 게시합니다.

설정 전(또는 연결 실패 시)에도 사이트 자체(일정 보기)는 정상 동작하며, 예산 탭에는 안내 배너가 표시됩니다.

## 2. GitHub Pages로 배포하기

1. GitHub에 새 저장소를 만듭니다 (저장소 이름은 폴더명과 동일하게 `europe-plan-2026` 권장).
2. 이 폴더에서 git 초기화 후 커밋, 원격 저장소에 push.
3. 저장소 **Settings → Pages**에서 Source를 `main` 브랜치 `/ (root)`로 설정.
4. 몇 분 후 `https://<사용자명>.github.io/europe-plan-2026/`로 접속 가능해집니다.
5. 배포된 URL을 다른 기기(휴대폰 등)에서도 열어 예산 항목이 실시간으로 공유되는지 확인하세요.

## 환율 안내

환율은 페이지 로드 시 무료 공개 API로 실시간 조회하며, 6시간 동안 브라우저에 캐시됩니다. 오프라인이거나 조회에 실패하면 원본 일정표에 기록된 값(CHF 1,850원 / EUR 1,710원)을 자동으로 사용합니다. 예산 탭 상단에 현재 적용된 환율과 조회 시각이 표시됩니다.
