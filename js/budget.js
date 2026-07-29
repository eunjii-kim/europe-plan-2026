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
import { buildCustomCostItemKeyPrefix } from './budgetCalc.js';

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
 * 기존 일정 비용 항목을 사용자가 지정한 값으로 덮어쓰거나, 새 비용 항목을 만든다.
 * setDoc은 merge 없이 문서를 통째로 덮어쓰므로 category를 항상 함께 보내야 한다.
 * @param {string} key - buildCostItemKey 또는 buildCustomCostItemKeyPrefix로 만든 항목 키
 * @param {{ category: string, amount: number, currency: string, headcount: number }} values
 * @returns {Promise<void>}
 */
export async function setBudgetOverride(key, values) {
  await setDoc(doc(budgetOverridesCollection, key), {
    category: values.category,
    amount: values.amount,
    currency: values.currency,
    headcount: values.headcount,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 기존 일정 비용 항목의 수정값을 삭제해 원래 값으로 되돌리거나, 사용자가 추가한 비용 항목을 삭제한다.
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function clearBudgetOverride(key) {
  await deleteDoc(doc(budgetOverridesCollection, key));
}

/**
 * 원본에 없던 새 비용 항목을 특정 블록(anchorKey)에 추가한다.
 * Firestore가 로컬에서 생성해주는 문서 ID를 접미사로 써서 키 충돌 없이 항목을 만든다.
 * @param {string} anchorKey - 원본 블록의 blockKey 또는 사용자가 추가한 블록의 customId
 * @param {{ category: string, amount: number, currency: string, headcount: number }} values
 * @returns {Promise<void>}
 */
export async function addCustomCostItem(anchorKey, values) {
  const suffix = doc(budgetOverridesCollection).id;
  await setBudgetOverride(buildCustomCostItemKeyPrefix(anchorKey) + suffix, values);
}
