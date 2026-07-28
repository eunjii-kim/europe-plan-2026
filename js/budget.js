import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { budgetItemsCollection, budgetOverridesCollection } from './firebaseConfig.js';

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

/**
 * 기존 일정 비용 항목의 수정값(budgetOverrides)을 실시간으로 구독한다.
 * @param {(overridesMap: Map<string, { amount: number, currency: string, headcount: number }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToBudgetOverrides(onChange, onError) {
  return onSnapshot(
    budgetOverridesCollection,
    (snapshot) => {
      const overridesMap = new Map();
      snapshot.docs.forEach((docSnap) => {
        overridesMap.set(docSnap.id, docSnap.data());
      });
      onChange(overridesMap);
    },
    (error) => {
      console.error('일정 비용 수정값 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 기존 일정 비용 항목을 사용자가 지정한 값으로 덮어쓴다.
 * @param {string} key - buildCostItemKey로 만든 항목 키
 * @param {{ amount: number, currency: string, headcount: number }} values
 * @returns {Promise<void>}
 */
export async function setBudgetOverride(key, values) {
  await setDoc(doc(budgetOverridesCollection, key), {
    amount: values.amount,
    currency: values.currency,
    headcount: values.headcount,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 기존 일정 비용 항목의 수정값을 삭제해 원래 값으로 되돌린다.
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function clearBudgetOverride(key) {
  await deleteDoc(doc(budgetOverridesCollection, key));
}
