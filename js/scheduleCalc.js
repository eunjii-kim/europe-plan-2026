/**
 * 일정 시간/내용 수정 관련 순수 함수 모음. DOM/Firestore를 직접 건드리지 않는다.
 */

/**
 * 일정 블록 하나를 Firestore 문서 ID로도 쓸 수 있는 고유 키로 변환한다.
 * @param {string} dayId
 * @param {number} blockIndex
 * @returns {string}
 */
export function buildScheduleBlockKey(dayId, blockIndex) {
  return `${dayId}__${blockIndex}`;
}

/**
 * 일정 수정값(scheduleOverridesMap)과 사용자가 추가한 일정(customBlocksByDay)을
 * 원본 itineraryData 위에 병합한 새 배열을 만든다. 원본은 변경하지 않는다.
 *
 * blockIndex는 원본 timeBlocks 배열을 그대로 순회하며 매길 때만 안정적이므로,
 * override 조회(및 key 부여)는 반드시 삭제 필터링/커스텀 블록 병합보다 먼저 끝낸다.
 * (applyBudgetOverrides의 blockIndex 안정성 원칙과 동일)
 *
 * @param {Array} itineraryData
 * @param {Map<string, { time: string, title: string, note: string, deleted?: boolean }>} scheduleOverridesMap
 * @param {Map<string, Array<{ id: string, dayId: string, time: string, title: string, note: string }>>} [customBlocksByDay]
 * @returns {Array}
 */
export function applyScheduleOverrides(itineraryData, scheduleOverridesMap, customBlocksByDay = new Map()) {
  return itineraryData.map((day) => {
    const editedBlocks = day.timeBlocks
      .map((block, blockIndex) => {
        const blockKey = buildScheduleBlockKey(day.id, blockIndex);
        const override = scheduleOverridesMap.get(blockKey);
        if (!override) {
          return { ...block, blockKey, overridden: false };
        }
        return {
          ...block,
          time: override.time,
          title: override.title,
          note: override.note,
          blockKey,
          overridden: true,
          deleted: Boolean(override.deleted),
          original: block,
        };
      })
      .filter((block) => !block.deleted);

    const customBlocks = (customBlocksByDay.get(day.id) || []).map((custom) => ({
      time: custom.time,
      title: custom.title,
      note: custom.note || '',
      costItems: [],
      isCustom: true,
      customId: custom.id,
    }));

    const timeBlocks = [...editedBlocks, ...customBlocks].sort((a, b) => a.time.localeCompare(b.time));
    return { ...day, timeBlocks };
  });
}
