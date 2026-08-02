import {
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { customPlaceCategoriesCollection } from './firebaseConfig.js';

/**
 * 사용자가 추가한 장소 분류 목록을 실시간으로 구독한다.
 * @param {(categories: Array<{ id: string, name: string }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToCustomPlaceCategories(onChange, onError) {
  const q = query(customPlaceCategoriesCollection, orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const categories = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onChange(categories);
    },
    (error) => {
      console.error('분류 목록 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 새 장소 분류를 추가한다.
 * @param {string} name
 * @returns {Promise<void>}
 */
export async function addCustomPlaceCategory(name) {
  await addDoc(customPlaceCategoriesCollection, {
    name,
    createdAt: serverTimestamp(),
  });
}
