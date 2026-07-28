import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { budgetItemsCollection } from './firebaseConfig.js';

/**
 * 사용자가 추가한 예산 항목 목록을 실시간으로 구독한다.
 * 다른 기기에서 항목을 추가/삭제하면 onChange가 자동으로 다시 호출된다.
 * @param {(items: Array<{ id: string, title: string, amount: number, currency: string }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToBudgetItems(onChange, onError) {
  const q = query(budgetItemsCollection, orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onChange(items);
    },
    (error) => {
      console.error('예산 목록 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 예산 항목을 새로 추가한다.
 * @param {{ title: string, amount: number, currency: string }} item
 * @returns {Promise<void>}
 */
export async function addBudgetItem(item) {
  await addDoc(budgetItemsCollection, {
    title: item.title,
    amount: item.amount,
    currency: item.currency,
    createdAt: serverTimestamp(),
  });
}

/**
 * 예산 항목을 삭제한다.
 * @param {string} itemId
 * @returns {Promise<void>}
 */
export async function deleteBudgetItem(itemId) {
  await deleteDoc(doc(budgetItemsCollection, itemId));
}
