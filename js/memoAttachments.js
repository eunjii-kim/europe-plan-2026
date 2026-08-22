/**
 * 메모에 붙이는 사진/표를 다루는 공용 로직.
 * 화면을 직접 그리지 않고 "값을 만들어 돌려주는" 일만 한다(그리기는 memoEditor.js와 render.js가 맡는다).
 */

import {
  MEMO_IMAGE_MAX_DIMENSION_PX,
  MEMO_IMAGE_QUALITY,
  MEMO_MAX_BYTES,
  MEMO_TABLE_DEFAULT_COLUMNS,
  MEMO_TABLE_DEFAULT_ROWS,
} from './constants.js';

/** 표 붙여넣기에서 열을 나누는 문자. 엑셀/구글 스프레드시트는 셀 사이를 탭으로 구분해 복사한다. */
const CLIPBOARD_COLUMN_SEPARATOR = '\t';

/**
 * 사진을 화면에 그릴 수 있는 형태(ImageBitmap 또는 HTMLImageElement)로 읽는다.
 * createImageBitmap은 사진의 회전 정보(EXIF)까지 반영해주지만 지원하지 않는 브라우저가 있어,
 * 그런 경우에는 <img>로 대신 읽는다.
 * @param {File} file
 * @returns {Promise<ImageBitmap | HTMLImageElement>}
 */
async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // 아래 <img> 방식으로 넘어간다.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('사진을 읽을 수 없습니다.'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 원본 크기를 비율 그대로 유지하면서 긴 변이 한도를 넘지 않도록 줄인 크기를 구한다.
 * 이미 한도보다 작으면 확대하지 않고 그대로 둔다.
 * @param {number} width
 * @param {number} height
 * @returns {{ width: number, height: number }}
 */
function fitWithinLimit(width, height) {
  const longestSide = Math.max(width, height);
  if (longestSide <= MEMO_IMAGE_MAX_DIMENSION_PX) return { width, height };
  const ratio = MEMO_IMAGE_MAX_DIMENSION_PX / longestSide;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/**
 * 기기에서 고른 사진 파일을 작게 줄여 Firestore에 그대로 넣을 수 있는 data URL로 바꾼다.
 * @param {File} file
 * @returns {Promise<{ id: string, dataUrl: string, name: string }>}
 */
export async function compressImageFile(file) {
  const source = await loadImageSource(file);
  const { width, height } = fitWithinLimit(source.width, source.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(source, 0, 0, width, height);
  source.close?.();

  return {
    id: crypto.randomUUID(),
    dataUrl: canvas.toDataURL('image/jpeg', MEMO_IMAGE_QUALITY),
    name: file.name || '',
  };
}

/**
 * 비어 있는 표를 만든다. 첫 행은 머리글로 쓴다.
 * @param {number} [rowCount]
 * @param {number} [columnCount]
 * @returns {{ id: string, rows: string[][] }}
 */
export function createEmptyTable(rowCount = MEMO_TABLE_DEFAULT_ROWS, columnCount = MEMO_TABLE_DEFAULT_COLUMNS) {
  const rows = Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ''));
  return { id: crypto.randomUUID(), rows };
}

/**
 * 모든 행의 길이를 가장 긴 행에 맞춰 빈 칸으로 채운다.
 * 붙여넣은 표는 행마다 열 수가 다를 수 있는데, 그대로 두면 표가 어긋나게 그려진다.
 * @param {string[][]} rows
 * @returns {string[][]}
 */
export function normalizeTableRows(rows) {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ''));
}

/**
 * 엑셀/구글 스프레드시트에서 복사한 텍스트를 표(2차원 배열)로 바꾼다.
 * 셀 하나만 복사한 경우(줄바꿈·탭이 없는 경우)는 표가 아니라 평범한 글자 입력이므로 null을 돌려준다.
 * @param {string} text - 붙여넣기 이벤트의 'text/plain' 값
 * @returns {string[][] | null}
 */
export function parseClipboardTable(text) {
  if (!text) return null;

  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  const hasMultipleCells = lines.length > 1 || lines[0].includes(CLIPBOARD_COLUMN_SEPARATOR);
  if (!hasMultipleCells) return null;

  return normalizeTableRows(lines.map((line) => line.split(CLIPBOARD_COLUMN_SEPARATOR)));
}

/**
 * 표에 내용이 하나라도 들어 있는지 확인한다. 만들어만 두고 비워 둔 표는 저장하지 않는다.
 * @param {{ rows: string[][] }} table
 * @returns {boolean}
 */
export function hasTableContent(table) {
  return table.rows.some((row) => row.some((cell) => cell.trim() !== ''));
}

/** 1MB를 byte로 나타낸 값. 용량을 사람이 읽는 단위로 바꿀 때 쓴다. */
const BYTES_PER_MEGABYTE = 1024 * 1024;

/**
 * byte 크기를 "1.2MB"처럼 읽기 쉬운 문자열로 바꾼다.
 * @param {number} bytes
 * @returns {string}
 */
export function formatMegabytes(bytes) {
  return `${(bytes / BYTES_PER_MEGABYTE).toFixed(1)}MB`;
}

/**
 * 메모 한 건이 Firestore 문서 한도에 걸리지 않는지 검사한다.
 * 사진을 문서 안에 직접 넣는 구조라 저장 전에 미리 확인해야 사용자가 이유를 알 수 있다.
 * @param {{ title: string, content: string, images: Array, tables: Array }} memo
 * @returns {{ withinLimit: boolean, bytes: number, limitBytes: number }}
 */
export function measureMemoSize(memo) {
  const bytes = new TextEncoder().encode(JSON.stringify(memo)).length;
  return { withinLimit: bytes <= MEMO_MAX_BYTES, bytes, limitBytes: MEMO_MAX_BYTES };
}
