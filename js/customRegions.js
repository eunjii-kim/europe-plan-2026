import {
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { customRegionsCollection } from './firebaseConfig.js';

/**
 * 사용자가 추가한 지역/도시 목록을 실시간으로 구독한다.
 * @param {(regions: Array<{ id: string, name: string }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToCustomRegions(onChange, onError) {
  const q = query(customRegionsCollection, orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const regions = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onChange(regions);
    },
    (error) => {
      console.error('지역 목록 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 새 지역/도시를 추가한다.
 * @param {string} name
 * @returns {Promise<void>}
 */
export async function addCustomRegion(name) {
  await addDoc(customRegionsCollection, {
    name,
    createdAt: serverTimestamp(),
  });
}
