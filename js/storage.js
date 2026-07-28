import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';
import { storage } from './firebaseConfig.js';
import { TRIP_ID } from './constants.js';

/** 첨부 이미지 업로드 최대 크기(바이트). Storage 보안 규칙과 값을 맞춰야 한다. */
const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 일정 블록에 붙일 이미지 파일을 Firebase Storage에 업로드하고 다운로드 URL을 반환한다.
 * @param {File} file
 * @param {string} blockKeyOrId - 업로드 대상 블록의 blockKey 또는 customId (경로 구분용)
 * @returns {Promise<string>} 업로드된 파일의 다운로드 URL
 */
export async function uploadScheduleAttachment(file, blockKeyOrId) {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }
  if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
    throw new Error('파일 크기는 10MB 이하만 가능합니다.');
  }
  const path = `schedule-attachments/${TRIP_ID}/${blockKeyOrId}/${Date.now()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
