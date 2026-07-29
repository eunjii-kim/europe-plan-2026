import { setActiveDayPill } from './render.js';

let observer = null;

/**
 * 일정 카드 목록을 관찰해 현재 스크롤 위치에 해당하는 날짜의 pill을 활성 표시한다.
 * sticky 헤더(탭바 + 날짜 네비게이션) 높이만큼 관찰 영역 상단을 잘라내, 그 아래
 * 뷰포트에 걸쳐 있는 카드 중 DOM 순서상 가장 위(=가장 먼저 보이는 날짜)를 활성으로 삼는다.
 * 하단은 자르지 않는다 — 페이지 맨 위처럼 탭바/날짜 네비가 아직 sticky로 고정되기 전에는
 * 카드가 뷰포트 상단에서 더 아래쪽에서 시작하므로, 밴드를 얇게 잘라내면 그 구간에
 * 카드가 하나도 걸치지 않아 하이라이트가 갱신되지 않는 문제가 생긴다.
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

  // entries에는 이번 콜백에서 "새로 바뀐" 요소만 담기므로, 현재 교차 상태는
  // 콜백을 넘나들며 누적되는 이 집합으로 계속 추적해야 한다. entries만 보고
  // 판단하면(특히 빠르게 스크롤할 때) 이번 배치에 활성 카드가 안 걸려
  // 하이라이트가 예전 위치에 멈춰 있는 문제가 생긴다.
  const visibleIds = new Set();

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleIds.add(entry.target.id);
        } else {
          visibleIds.delete(entry.target.id);
        }
      });
      if (visibleIds.size === 0) return;
      const activeCard = cards.find((card) => visibleIds.has(card.id));
      if (activeCard) {
        setActiveDayPill(dayNavEl, activeCard.id);
      }
    },
    {
      root: null,
      rootMargin: `-${stickyOffset}px 0px 0px 0px`,
      threshold: 0,
    },
  );

  cards.forEach((card) => observer.observe(card));
}
