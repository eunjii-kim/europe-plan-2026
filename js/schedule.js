import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { scheduleOverridesCollection, scheduleCustomBlocksCollection } from './firebaseConfig.js';

/**
 * 기존 일정 블록의 수정값(scheduleOverrides)을 실시간으로 구독한다.
 * @param {(overridesMap: Map<string, { time: string, title: string, note: string, deleted: boolean }>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToScheduleOverrides(onChange, onError) {
  return onSnapshot(
    scheduleOverridesCollection,
    (snapshot) => {
      const overridesMap = new Map();
      snapshot.docs.forEach((docSnap) => {
        overridesMap.set(docSnap.id, docSnap.data());
      });
      onChange(overridesMap);
    },
    (error) => {
      console.error('일정 수정값 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 기존 일정 블록을 사용자가 지정한 값으로 덮어쓴다.
 * @param {string} blockKey - buildScheduleBlockKey로 만든 키
 * @param {{ time: string, title: string, note: string, deleted?: boolean }} values
 * @returns {Promise<void>}
 */
export async function setScheduleOverride(blockKey, values) {
  await setDoc(doc(scheduleOverridesCollection, blockKey), {
    time: values.time,
    title: values.title,
    note: values.note,
    deleted: Boolean(values.deleted),
    updatedAt: serverTimestamp(),
  });
}

/**
 * 일정 블록 수정값을 삭제해 원래 값으로 되돌린다.
 * @param {string} blockKey
 * @returns {Promise<void>}
 */
export async function clearScheduleOverride(blockKey) {
  await deleteDoc(doc(scheduleOverridesCollection, blockKey));
}

/**
 * 사용자가 추가한 일정 블록 목록을 날짜별로 실시간 구독한다.
 * @param {(customBlocksByDay: Map<string, Array<{ id: string, dayId: string, time: string, title: string, note: string }>>) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeToScheduleCustomBlocks(onChange, onError) {
  return onSnapshot(
    scheduleCustomBlocksCollection,
    (snapshot) => {
      const byDay = new Map();
      snapshot.docs.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        const list = byDay.get(data.dayId) || [];
        list.push(data);
        byDay.set(data.dayId, list);
      });
      onChange(byDay);
    },
    (error) => {
      console.error('추가 일정 구독 실패', error);
      onError(error);
    },
  );
}

/**
 * 새 일정 블록을 특정 날짜에 추가한다.
 * @param {string} dayId
 * @param {{ time: string, title: string, note: string }} values
 * @returns {Promise<void>}
 */
export async function addScheduleCustomBlock(dayId, values) {
  await addDoc(scheduleCustomBlocksCollection, {
    dayId,
    time: values.time,
    title: values.title,
    note: values.note,
    createdAt: serverTimestamp(),
  });
}

/**
 * 사용자가 추가한 일정 블록을 삭제한다.
 * @param {string} customId
 * @returns {Promise<void>}
 */
export async function deleteScheduleCustomBlock(customId) {
  await deleteDoc(doc(scheduleCustomBlocksCollection, customId));
}
