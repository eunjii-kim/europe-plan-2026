import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { expensesCollection } from './firebaseConfig.js';

/**
 * 지출 기록 목록을 실시간으로 구독한다. 날짜순으로 정렬된다.
 * @param {(items: Array<{ id: string, date: string, category: string, title: string, region: string, amount: number, currency: string }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToExpenses(onChange, onError) {
  const q = query(expensesCollection, orderBy('date', 'asc'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onChange(items);
    },
    (error) => {
      console.error('지출 기록 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 지출 기록을 새로 추가한다.
 * @param {{ date: string, category: string, title: string, region: string, amount: number, currency: string }} expense
 * @returns {Promise<void>}
 */
export async function addExpense(expense) {
  await addDoc(expensesCollection, {
    date: expense.date,
    category: expense.category,
    title: expense.title || '',
    region: expense.region || '',
    amount: expense.amount,
    currency: expense.currency,
    createdAt: serverTimestamp(),
  });
}

/**
 * 지출 기록을 삭제한다.
 * @param {string} expenseId
 * @returns {Promise<void>}
 */
export async function deleteExpense(expenseId) {
  await deleteDoc(doc(expensesCollection, expenseId));
}
