/**
 * 메모에 사진과 표를 붙이는 편집 UI.
 * "+ 글쓰기" 폼(app.js)과 카드 인라인 수정 폼(render.js) 양쪽에서 같은 편집기를 쓰기 위해 따로 뒀다.
 */

import { ICONS, MEMO_TABLE_MAX_COLUMNS } from './constants.js';
import {
  TABLE_TEXT_SEPARATORS,
  compressImageFile,
  createEmptyTable,
  createTableFromRows,
  hasTableContent,
  parseClipboardTable,
  parseTableText,
} from './memoAttachments.js';

/**
 * 아이콘 하나만 들어가는 작은 버튼을 만든다.
 * @param {string} className
 * @param {string} icon - ICONS의 SVG 문자열
 * @param {string} label - 화면 낭독기용 설명
 * @param {() => void} onClick
 * @returns {HTMLButtonElement}
 */
function createIconButton(className, icon, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.innerHTML = icon;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  return button;
}

/**
 * 표 하나를 편집하는 격자를 만든다. 첫 행은 머리글이다.
 * 셀에 엑셀/스프레드시트 내용을 붙여넣으면 탭·줄바꿈을 읽어 행과 열을 자동으로 늘려 채운다.
 * @param {{ id: string, rows: string[][] }} table
 * @param {() => void} onRemove - 표 전체 삭제
 * @returns {{ element: HTMLElement, collect: () => { id: string, rows: string[][] } }}
 */
function createTableEditor(table, onRemove) {
  const wrapper = document.createElement('div');
  wrapper.className = 'memo-table-editor';

  const grid = document.createElement('div');
  grid.className = 'memo-table-grid';

  // 화면에 그려진 값을 그대로 들고 있는 원본. 행/열을 더하거나 지울 때마다 이 값을 고쳐 다시 그린다.
  let rows = table.rows.map((row) => [...row]);

  /** 사용자가 지금까지 입력한 값을 격자에서 읽어 rows에 반영한다. */
  function syncRowsFromInputs() {
    grid.querySelectorAll('.memo-table-cell').forEach((input) => {
      rows[Number(input.dataset.row)][Number(input.dataset.column)] = input.value;
    });
  }

  /**
   * 붙여넣은 표를 (rowIndex, columnIndex) 칸부터 채운다. 모자라는 행/열은 새로 만든다.
   * @param {string[][]} pasted
   * @param {number} rowIndex
   * @param {number} columnIndex
   */
  function applyPastedTable(pasted, rowIndex, columnIndex) {
    syncRowsFromInputs();

    const neededColumns = Math.min(columnIndex + pasted[0].length, MEMO_TABLE_MAX_COLUMNS);
    const neededRows = rowIndex + pasted.length;

    while (rows.length < neededRows) rows.push(Array.from({ length: rows[0].length }, () => ''));
    rows = rows.map((row) => Array.from({ length: Math.max(row.length, neededColumns) }, (_, i) => row[i] ?? ''));

    pasted.forEach((pastedRow, r) => {
      pastedRow.forEach((cell, c) => {
        const targetColumn = columnIndex + c;
        if (targetColumn >= MEMO_TABLE_MAX_COLUMNS) return;
        rows[rowIndex + r][targetColumn] = cell;
      });
    });

    draw();
  }

  function draw() {
    grid.innerHTML = '';

    const tableEl = document.createElement('table');
    tableEl.className = 'memo-table-input-table';

    // 열 삭제 버튼 줄. 각 열 위에 ×를 두면 가운데 열도 바로 지울 수 있다.
    const columnControlRow = document.createElement('tr');
    columnControlRow.className = 'memo-table-column-controls';
    rows[0].forEach((_, columnIndex) => {
      const cell = document.createElement('th');
      if (rows[0].length > 1) {
        cell.appendChild(
          createIconButton('memo-table-remove-column', ICONS.x, `${columnIndex + 1}번째 열 삭제`, () => {
            syncRowsFromInputs();
            rows = rows.map((row) => row.filter((_, i) => i !== columnIndex));
            draw();
          }),
        );
      }
      columnControlRow.appendChild(cell);
    });
    columnControlRow.appendChild(document.createElement('th'));
    tableEl.appendChild(columnControlRow);

    rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      const isHeaderRow = rowIndex === 0;

      row.forEach((value, columnIndex) => {
        const cell = document.createElement(isHeaderRow ? 'th' : 'td');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'memo-table-cell';
        input.value = value;
        input.dataset.row = String(rowIndex);
        input.dataset.column = String(columnIndex);
        input.placeholder = isHeaderRow ? '머리글' : '';
        input.setAttribute('aria-label', `${rowIndex + 1}행 ${columnIndex + 1}열`);
        // 칸을 입력하다 Enter를 누르면 메모 폼이 통째로 저장되어 버리므로 막는다.
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') event.preventDefault();
        });
        input.addEventListener('paste', (event) => {
          const pasted = parseClipboardTable(event.clipboardData?.getData('text/plain') || '');
          if (!pasted) return;
          event.preventDefault();
          applyPastedTable(pasted, rowIndex, columnIndex);
        });
        cell.appendChild(input);
        tr.appendChild(cell);
      });

      // 머리글 행은 표의 뼈대라 지울 수 없게 두고, 데이터 행만 삭제 버튼을 붙인다.
      const rowControl = document.createElement(isHeaderRow ? 'th' : 'td');
      if (!isHeaderRow) {
        rowControl.appendChild(
          createIconButton('memo-table-remove-row', ICONS.x, `${rowIndex + 1}행 삭제`, () => {
            syncRowsFromInputs();
            rows = rows.filter((_, i) => i !== rowIndex);
            draw();
          }),
        );
      }
      tr.appendChild(rowControl);

      tableEl.appendChild(tr);
    });

    grid.appendChild(tableEl);
  }

  const actions = document.createElement('div');
  actions.className = 'memo-table-actions';

  const addRowButton = document.createElement('button');
  addRowButton.type = 'button';
  addRowButton.className = 'memo-table-action';
  addRowButton.textContent = '+ 행';
  addRowButton.addEventListener('click', () => {
    syncRowsFromInputs();
    rows.push(Array.from({ length: rows[0].length }, () => ''));
    draw();
  });

  const addColumnButton = document.createElement('button');
  addColumnButton.type = 'button';
  addColumnButton.className = 'memo-table-action';
  addColumnButton.textContent = '+ 열';
  addColumnButton.addEventListener('click', () => {
    if (rows[0].length >= MEMO_TABLE_MAX_COLUMNS) return;
    syncRowsFromInputs();
    rows = rows.map((row) => [...row, '']);
    draw();
  });

  const removeTableButton = document.createElement('button');
  removeTableButton.type = 'button';
  removeTableButton.className = 'memo-table-action memo-table-action-remove';
  removeTableButton.innerHTML = `${ICONS.trash} 표 삭제`;
  removeTableButton.addEventListener('click', onRemove);

  actions.append(addRowButton, addColumnButton, removeTableButton);
  wrapper.append(grid, actions);
  draw();

  return {
    element: wrapper,
    collect: () => {
      syncRowsFromInputs();
      return { id: table.id, rows: rows.map((row) => row.map((cell) => cell.trim())) };
    },
  };
}

/**
 * 붙여넣은 텍스트를 표로 바꿔주는 입력창을 만든다.
 * 휴대폰에서는 표 칸에 바로 붙여넣어도 앱이 탭을 넣어주지 않아 한 칸에 다 들어가는 경우가 있어,
 * 텍스트를 통째로 받아 구분 방식을 직접 고를 수 있는 길을 따로 뒀다.
 * @param {(rows: string[][]) => void} onCreate
 * @returns {{ element: HTMLElement, toggle: () => void, close: () => void }}
 */
function createTablePasteBox(onCreate) {
  const box = document.createElement('div');
  box.className = 'memo-table-paste-box';
  box.hidden = true;

  const textarea = document.createElement('textarea');
  textarea.className = 'memo-table-paste-input';
  textarea.placeholder = '스프레드시트에서 복사한 내용을 여기에 붙여넣으세요.';
  textarea.setAttribute('aria-label', '표로 만들 텍스트');

  const separatorRow = document.createElement('div');
  separatorRow.className = 'memo-table-paste-separator';
  const separatorLabel = document.createElement('span');
  separatorLabel.textContent = '열 구분';
  const separatorSelect = document.createElement('select');
  separatorSelect.setAttribute('aria-label', '열 구분 방식');
  separatorSelect.innerHTML = TABLE_TEXT_SEPARATORS.map(
    (option) => `<option value="${option.value}">${option.label}</option>`,
  ).join('');
  separatorRow.append(separatorLabel, separatorSelect);

  const message = document.createElement('p');
  message.className = 'memo-table-paste-message';
  message.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'memo-table-actions';

  const close = () => {
    box.hidden = true;
    textarea.value = '';
    message.hidden = true;
  };

  const createButton = document.createElement('button');
  createButton.type = 'button';
  createButton.className = 'memo-table-action';
  createButton.textContent = '표로 만들기';
  createButton.addEventListener('click', () => {
    const rows = parseTableText(textarea.value, separatorSelect.value);
    if (!rows) {
      message.textContent = '표로 만들 내용이 없습니다.';
      message.hidden = false;
      return;
    }
    onCreate(rows);
    close();
  });

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'memo-table-action';
  cancelButton.textContent = '취소';
  cancelButton.addEventListener('click', close);

  actions.append(createButton, cancelButton);
  box.append(textarea, separatorRow, message, actions);

  return {
    element: box,
    toggle: () => {
      box.hidden = !box.hidden;
      if (!box.hidden) textarea.focus();
    },
    close,
  };
}

/**
 * 메모의 사진/표 편집기를 만든다. 저장할 값은 collect()로 한 번에 꺼낸다.
 * @param {{ images?: Array<{ id: string, dataUrl: string, name: string }>, tables?: Array<{ id: string, rows: string[][] }> }} [initial]
 * @returns {{ element: HTMLElement, collect: () => { images: Array, tables: Array }, reset: () => void }}
 */
export function createMemoAttachmentsEditor(initial = {}) {
  const element = document.createElement('div');
  element.className = 'memo-attachments-editor';

  const message = document.createElement('p');
  message.className = 'memo-attachments-message';
  message.hidden = true;

  // --- 사진 ---
  const imageSection = document.createElement('div');
  imageSection.className = 'memo-attachment-section';

  const imageLabel = document.createElement('p');
  imageLabel.className = 'memo-attachment-label';
  imageLabel.textContent = '사진';

  const imageList = document.createElement('ul');
  imageList.className = 'memo-image-edit-list';

  /** @type {Array<{ id: string, dataUrl: string, name: string }>} */
  let images = [];

  function drawImages() {
    imageList.innerHTML = '';
    images.forEach((image) => {
      const li = document.createElement('li');
      li.className = 'memo-image-edit-item';

      const img = document.createElement('img');
      img.src = image.dataUrl;
      img.alt = image.name || '첨부 사진';
      img.loading = 'lazy';

      li.append(
        img,
        createIconButton('memo-image-remove', ICONS.x, '사진 삭제', () => {
          images = images.filter((candidate) => candidate.id !== image.id);
          drawImages();
        }),
      );
      imageList.appendChild(li);
    });
  }

  // 파일 선택창은 눈에 보이는 input 대신 버튼으로 열어야 폼 안에서 모양이 일관된다.
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.multiple = true;
  fileInput.hidden = true;

  const addImageButton = document.createElement('button');
  addImageButton.type = 'button';
  addImageButton.className = 'memo-attachment-add-button';
  addImageButton.textContent = '+ 사진 추가';
  addImageButton.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    if (files.length === 0) return;

    addImageButton.disabled = true;
    addImageButton.textContent = '사진 줄이는 중...';
    message.hidden = true;

    try {
      for (const file of files) {
        images.push(await compressImageFile(file));
      }
      drawImages();
    } catch (error) {
      console.error('사진 첨부 실패', error);
      message.textContent = '사진을 불러오지 못했습니다. 다른 사진으로 다시 시도해 주세요.';
      message.hidden = false;
    } finally {
      addImageButton.disabled = false;
      addImageButton.textContent = '+ 사진 추가';
    }
  });

  imageSection.append(imageLabel, imageList, addImageButton, fileInput);

  // --- 표 ---
  const tableSection = document.createElement('div');
  tableSection.className = 'memo-attachment-section';

  const tableLabel = document.createElement('p');
  tableLabel.className = 'memo-attachment-label';
  tableLabel.textContent = '표';

  const tableHint = document.createElement('p');
  tableHint.className = 'memo-attachment-hint';
  tableHint.textContent =
    '엑셀·스프레드시트에서 복사한 내용을 칸에 붙여넣으면 행과 열이 자동으로 채워집니다. 한 칸에 다 들어가 버리면 "붙여넣기로 표 만들기"를 쓰세요.';

  const tableList = document.createElement('div');
  tableList.className = 'memo-table-edit-list';

  /** 표 편집기들. 화면에서 지운 것은 배열에서도 함께 빼서 collect()에 잡히지 않게 한다. */
  let tableEditors = [];

  function addTable(table) {
    const editor = createTableEditor(table, () => {
      tableEditors = tableEditors.filter((candidate) => candidate !== editor);
      editor.element.remove();
    });
    tableEditors.push(editor);
    tableList.appendChild(editor.element);
  }

  const pasteBox = createTablePasteBox((rows) => addTable(createTableFromRows(rows)));

  const tableButtons = document.createElement('div');
  tableButtons.className = 'memo-table-add-buttons';

  const addTableButton = document.createElement('button');
  addTableButton.type = 'button';
  addTableButton.className = 'memo-attachment-add-button';
  addTableButton.textContent = '+ 표 추가';
  addTableButton.addEventListener('click', () => addTable(createEmptyTable()));

  const pasteToggleButton = document.createElement('button');
  pasteToggleButton.type = 'button';
  pasteToggleButton.className = 'memo-attachment-add-button';
  pasteToggleButton.textContent = '+ 붙여넣기로 표 만들기';
  pasteToggleButton.addEventListener('click', () => pasteBox.toggle());

  tableButtons.append(addTableButton, pasteToggleButton);
  tableSection.append(tableLabel, tableHint, tableList, tableButtons, pasteBox.element);
  element.append(message, imageSection, tableSection);

  /** 편집기를 주어진 값으로 처음부터 다시 채운다. */
  function load({ images: initialImages = [], tables: initialTables = [] }) {
    images = initialImages.map((image) => ({ ...image }));
    drawImages();

    tableEditors = [];
    tableList.innerHTML = '';
    initialTables.forEach((table) => addTable({ id: table.id, rows: table.rows.map((row) => [...row]) }));

    pasteBox.close();
    message.hidden = true;
  }

  load(initial);

  return {
    element,
    // 내용을 하나도 채우지 않은 빈 표는 저장하지 않는다.
    collect: () => ({ images, tables: tableEditors.map((editor) => editor.collect()).filter(hasTableContent) }),
    reset: () => load({}),
  };
}
