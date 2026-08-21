import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { memosCollection } from './firebaseConfig.js';

/**
 * 메모 목록을 최신순으로 실시간 구독한다.
 * @param {(items: Array<{ id: string, title: string, content: string }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToMemos(onChange, onError) {
  const q = query(memosCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onChange(items);
    },
    (error) => {
      console.error('메모 목록 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 새 메모를 추가한다.
 * @param {{ title: string, content: string }} memo
 * @returns {Promise<void>}
 */
export async function addMemo(memo) {
  await addDoc(memosCollection, {
    title: memo.title,
    content: memo.content || '',
    createdAt: serverTimestamp(),
  });
}

/**
 * 메모를 삭제한다.
 * @param {string} memoId
 * @returns {Promise<void>}
 */
export async function deleteMemo(memoId) {
  await deleteDoc(doc(memosCollection, memoId));
}

/**
 * 저장된 메모를 수정한다.
 * @param {string} memoId
 * @param {{ title: string, content: string }} values
 * @returns {Promise<void>}
 */
export async function updateMemo(memoId, values) {
  await updateDoc(doc(memosCollection, memoId), {
    title: values.title,
    content: values.content || '',
  });
}
