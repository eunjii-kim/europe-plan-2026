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
import { checklistSectionsCollection, checklistItemsCollection } from './firebaseConfig.js';

/**
 * 체크리스트 섹션 목록을 실시간으로 구독한다.
 * @param {(sections: Array<{ id: string, title: string }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToChecklistSections(onChange, onError) {
  const q = query(checklistSectionsCollection, orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const sections = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onChange(sections);
    },
    (error) => {
      console.error('체크리스트 섹션 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 새 섹션을 추가한다.
 * @param {string} title
 * @returns {Promise<void>}
 */
export async function addChecklistSection(title) {
  await addDoc(checklistSectionsCollection, {
    title,
    createdAt: serverTimestamp(),
  });
}

/**
 * 섹션을 삭제한다. 섹션에 속한 준비물은 이 함수가 아니라 호출하는 쪽에서
 * deleteChecklistItem으로 각각 먼저 지워야 한다 (Firestore는 하위 문서를 자동으로 지우지 않는다).
 * @param {string} sectionId
 * @returns {Promise<void>}
 */
export async function deleteChecklistSection(sectionId) {
  await deleteDoc(doc(checklistSectionsCollection, sectionId));
}

/**
 * 섹션별 준비물 목록을 실시간으로 구독한다.
 * @param {(items: Array<{ id: string, sectionId: string, title: string, checked: boolean, memo: string }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToChecklistItems(onChange, onError) {
  const q = query(checklistItemsCollection, orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onChange(items);
    },
    (error) => {
      console.error('체크리스트 준비물 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 섹션에 새 준비물을 추가한다.
 * @param {string} sectionId
 * @param {string} title
 * @returns {Promise<void>}
 */
export async function addChecklistItem(sectionId, title) {
  await addDoc(checklistItemsCollection, {
    sectionId,
    title,
    checked: false,
    memo: '',
    createdAt: serverTimestamp(),
  });
}

/**
 * 준비물을 삭제한다.
 * @param {string} itemId
 * @returns {Promise<void>}
 */
export async function deleteChecklistItem(itemId) {
  await deleteDoc(doc(checklistItemsCollection, itemId));
}

/**
 * 준비물의 체크 여부를 바꾼다.
 * @param {string} itemId
 * @param {boolean} checked
 * @returns {Promise<void>}
 */
export async function toggleChecklistItem(itemId, checked) {
  await updateDoc(doc(checklistItemsCollection, itemId), { checked });
}

/**
 * 준비물의 메모를 수정한다.
 * @param {string} itemId
 * @param {string} memo
 * @returns {Promise<void>}
 */
export async function updateChecklistItemMemo(itemId, memo) {
  await updateDoc(doc(checklistItemsCollection, itemId), { memo });
}
