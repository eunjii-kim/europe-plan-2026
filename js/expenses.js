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
 * 지출 기록 목록을 실시간으로 구독한다. 날짜순으로 정렬되며, 같은 날짜 안에서는 추가한 순서로 정렬된다.
 * 정렬 필드를 date 하나로 두는 이유는, date+createdAt 두 필드로 서버 정렬하면 Firestore 복합 색인을
 * 콘솔에서 미리 만들어둬야 하기 때문이다 — 같은 날짜 내 정렬은 대신 클라이언트에서 처리한다.
 * @param {(items: Array<{ id: string, date: string, category: string, title: string, region: string, amount: number, currency: string }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToExpenses(onChange, onError) {
  const q = query(expensesCollection, orderBy('date', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      items.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
      });
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
