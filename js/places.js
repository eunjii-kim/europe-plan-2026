import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { placesCollection } from './firebaseConfig.js';

/**
 * 조사한 장소(맛집/카페/쇼핑 등) 목록을 실시간으로 구독한다.
 * @param {(items: Array<{ id: string, category: string, title: string, region: string, link: string, memo: string }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToPlaces(onChange, onError) {
  const q = query(placesCollection, orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onChange(items);
    },
    (error) => {
      console.error('장소 목록 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 장소를 새로 추가한다.
 * @param {{ category: string, title: string, region: string, link: string, memo: string }} place
 * @returns {Promise<void>}
 */
export async function addPlace(place) {
  await addDoc(placesCollection, {
    category: place.category,
    title: place.title,
    region: place.region || '',
    link: place.link || '',
    memo: place.memo || '',
    createdAt: serverTimestamp(),
  });
}

/**
 * 장소를 삭제한다.
 * @param {string} placeId
 * @returns {Promise<void>}
 */
export async function deletePlace(placeId) {
  await deleteDoc(doc(placesCollection, placeId));
}
