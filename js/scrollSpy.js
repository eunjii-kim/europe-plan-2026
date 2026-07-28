import { setActiveDayPill } from './render.js';

let observer = null;

/**
 * 일정 카드 목록을 관찰해 현재 스크롤 위치에 해당하는 날짜의 pill을 활성 표시한다.
 * sticky 헤더(탭바 + 날짜 네비게이션) 높이를 반영해 관찰 영역을 좁혀,
 * 뷰포트 상단(스티키 헤더 바로 아래)에 걸린 카드만 "활성"으로 취급한다.
 * dayList가 다시 그려질 때마다(day-card 요소가 새로 생성되므로) 반드시 다시 호출해야 한다.
 * @param {HTMLElement} dayListEl
 * @param {HTMLElement} dayNavEl
 * @param {HTMLElement} tabBarEl
 */
export function setupScrollSpy(dayListEl, dayNavEl, tabBarEl) {
  observer?.disconnect();

  const cards = [...dayListEl.querySelectorAll('.day-card')];
  if (cards.length === 0) return;

  const stickyOffset = tabBarEl.offsetHeight + dayNavEl.offsetHeight;
  const bottomMargin = Math.max(window.innerHeight - stickyOffset - 80, 0);

  observer = new IntersectionObserver(
    (entries) => {
      const visibleIds = new Set(
        entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target.id),
      );
      if (visibleIds.size === 0) return;
      const activeCard = cards.find((card) => visibleIds.has(card.id));
      if (activeCard) {
        setActiveDayPill(dayNavEl, activeCard.id);
      }
    },
    {
      root: null,
      rootMargin: `-${stickyOffset + 1}px 0px -${bottomMargin}px 0px`,
      threshold: 0,
    },
  );

  cards.forEach((card) => observer.observe(card));
}
