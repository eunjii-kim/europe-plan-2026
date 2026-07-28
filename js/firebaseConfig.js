import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, collection } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { TRIP_ID } from './constants.js';

/**
 * Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹 앱)에서 발급받은 값을 아래에 그대로 붙여넣는다.
 * 이 값들은 비밀키가 아니라 클라이언트 식별용 공개 설정값이라 커밋해도 안전하다.
 * 실제 접근 제어는 Firestore 보안 규칙(README.md 참고)이 담당한다.
 * 설정 전에는 예산 탭의 "다른 기기와 공유" 기능이 동작하지 않고 에러 배너가 표시된다.
 */
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

/** firebaseConfig가 실제 값으로 채워졌는지 여부 */
export const isFirebaseConfigured = firebaseConfig.apiKey !== 'YOUR_API_KEY';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/** trips/{TRIP_ID}/budgetItems 서브컬렉션 참조 */
export const budgetItemsCollection = collection(db, 'trips', TRIP_ID, 'budgetItems');
