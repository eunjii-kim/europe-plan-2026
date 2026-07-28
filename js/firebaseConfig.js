import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore, collection } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';
import { TRIP_ID } from './constants.js';

/**
 * Firebase 콘솔(europe-plan-2026 프로젝트) > 프로젝트 설정 > 내 앱에서 발급받은 값.
 * 이 값들은 비밀키가 아니라 클라이언트 식별용 공개 설정값이라 커밋해도 안전하다.
 * 실제 접근 제어는 Firestore 보안 규칙(README.md 참고)이 담당한다.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyDHqQfCgSXeyn4ZtBCLc9SRIHgH3pqLNYI',
  authDomain: 'europe-plan-2026.firebaseapp.com',
  projectId: 'europe-plan-2026',
  storageBucket: 'europe-plan-2026.firebasestorage.app',
  messagingSenderId: '831428012093',
  appId: '1:831428012093:web:4e4e6fca3d95b01908e254',
};

/** firebaseConfig가 실제 값으로 채워졌는지 여부 */
export const isFirebaseConfigured = firebaseConfig.apiKey !== 'YOUR_API_KEY';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/** 일정 첨부 이미지 업로드용 Firebase Storage 인스턴스. Storage는 콘솔에서 별도로 활성화해야 한다(README.md 참고). */
export const storage = getStorage(app);

/** trips/{TRIP_ID}/budgetItems 서브컬렉션 참조 (사용자가 추가한 예산) */
export const budgetItemsCollection = collection(db, 'trips', TRIP_ID, 'budgetItems');

/** trips/{TRIP_ID}/budgetOverrides 서브컬렉션 참조 (기존 일정 비용 수정값) */
export const budgetOverridesCollection = collection(db, 'trips', TRIP_ID, 'budgetOverrides');

/** trips/{TRIP_ID}/scheduleOverrides 서브컬렉션 참조 (기존 일정 시간/제목/메모 수정값) */
export const scheduleOverridesCollection = collection(db, 'trips', TRIP_ID, 'scheduleOverrides');

/** trips/{TRIP_ID}/scheduleCustomBlocks 서브컬렉션 참조 (사용자가 추가한 일정) */
export const scheduleCustomBlocksCollection = collection(db, 'trips', TRIP_ID, 'scheduleCustomBlocks');
