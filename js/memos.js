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
 * 표를 Firestore에 넣을 수 있는 형태로 바꾼다.
 * Firestore는 배열 안에 배열을 넣지 못하므로, 각 행을 { cells: [...] } 객체로 한 겹 감싼다.
 * @param {Array<{ id: string, rows: string[][] }>} tables
 * @returns {Array<{ id: string, rows: Array<{ cells: string[] }> }>}
 */
function toStoredTables(tables) {
  return (tables || []).map((table) => ({
    id: table.id,
    rows: table.rows.map((cells) => ({ cells })),
  }));
}

/**
 * Firestore에서 읽은 표를 앱에서 쓰는 2차원 배열 형태로 되돌린다.
 * @param {Array<{ id: string, rows: Array<{ cells: string[] }> }>} storedTables
 * @returns {Array<{ id: string, rows: string[][] }>}
 */
function fromStoredTables(storedTables) {
  return (storedTables || []).map((table) => ({
    id: table.id,
    rows: (table.rows || []).map((row) => row.cells || []),
  }));
}

/**
 * 메모 목록을 최신순으로 실시간 구독한다.
 * @param {(items: Array<{ id: string, title: string, content: string, images: Array, tables: Array }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToMemos(onChange, onError) {
  const q = query(memosCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          images: data.images || [],
          tables: fromStoredTables(data.tables),
        };
      });
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
 * @param {{ title: string, content: string, images?: Array, tables?: Array }} memo
 * @returns {Promise<void>}
 */
export async function addMemo(memo) {
  await addDoc(memosCollection, {
    title: memo.title,
    content: memo.content || '',
    images: memo.images || [],
    tables: toStoredTables(memo.tables),
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
 * @param {{ title: string, content: string, images?: Array, tables?: Array }} values
 * @returns {Promise<void>}
 */
export async function updateMemo(memoId, values) {
  await updateDoc(doc(memosCollection, memoId), {
    title: values.title,
    content: values.content || '',
    images: values.images || [],
    tables: toStoredTables(values.tables),
  });
}
