# 2026 유럽여행 일정 웹사이트

스위스·이탈리아 2026년 유럽여행(9/26~10/18) 일정표를 웹에서 보기 편하게 정리하고, 필요한 예산을 여러 기기에서 함께 관리할 수 있는 사이트입니다.

## 로컬에서 실행하기

ES 모듈(`import`/`export`)을 쓰기 때문에 `file://`로 직접 열면 CORS 오류가 납니다. 반드시 간단한 정적 서버로 실행하세요.

```bash
cd "europe-plan-2026"
python3 -m http.server 8000
```

그 후 브라우저에서 `http://localhost:8000` 접속.

## 1. Firebase 설정하기 (여러 기기 예산 공유용)

예산 탭의 "추가 필요 예산"을 여러 기기에서 공유하려면 Firebase Firestore를 연결해야 합니다. 아래 순서대로 진행하세요.

1. [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트를 만듭니다. (예: `europe-plan-2026`)
2. 왼쪽 메뉴에서 **Firestore Database** → "데이터베이스 만들기" → 리전은 `asia-northeast3 (서울)` 선택 → 프로덕션 모드로 시작.
3. 좌측 상단 톱니바퀴(프로젝트 설정) → "내 앱" → 웹 아이콘(`</>`)으로 웹 앱 등록 → 이름은 자유롭게 입력.
4. 등록 후 나오는 `firebaseConfig` 값을 복사합니다.
5. `js/firebaseConfig.js` 파일을 열어 `firebaseConfig` 객체의 `YOUR_...` 부분을 방금 복사한 값으로 바꿉니다.
6. Firestore "규칙" 탭에서 아래 규칙을 붙여넣고 게시합니다.

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
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> `firebaseConfig.js`의 값들은 비밀키가 아니라 클라이언트 식별용 공개 설정값이라 깃허브에 올려도 안전합니다. 실제 접근 제어는 위 Firestore 규칙이 담당합니다. 다만 로그인 없이 누구나 쓰기가 가능한 구조이므로, 더 강한 보안이 필요하면 Firebase Anonymous Auth 도입을 고려하세요.

설정을 마치지 않아도 사이트 자체(일정 보기)는 정상 동작하며, 예산 탭에는 "Firebase가 아직 설정되지 않았습니다" 안내가 표시됩니다.

## 2. GitHub Pages로 배포하기

1. GitHub에 새 저장소를 만듭니다 (저장소 이름은 폴더명과 동일하게 `europe-plan-2026` 권장).
2. 이 폴더에서 git 초기화 후 커밋, 원격 저장소에 push.
3. 저장소 **Settings → Pages**에서 Source를 `main` 브랜치 `/ (root)`로 설정.
4. 몇 분 후 `https://<사용자명>.github.io/europe-plan-2026/`로 접속 가능해집니다.
5. 배포된 URL을 다른 기기(휴대폰 등)에서도 열어 예산 항목이 실시간으로 공유되는지 확인하세요.

## 환율 안내

환율은 페이지 로드 시 무료 공개 API로 실시간 조회하며, 6시간 동안 브라우저에 캐시됩니다. 오프라인이거나 조회에 실패하면 원본 일정표에 기록된 값(CHF 1,850원 / EUR 1,710원)을 자동으로 사용합니다. 예산 탭 상단에 현재 적용된 환율과 조회 시각이 표시됩니다.
