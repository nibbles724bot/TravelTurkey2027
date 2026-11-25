'use strict';
const slides = [...document.querySelectorAll('.slide')];
const search = document.querySelector('#search');
const result = document.querySelector('#result');
function filterSlides() {
  const query = search.value.trim().toLocaleLowerCase();
  let count = 0;
  for (const slide of slides) {
    slide.hidden = !slide.dataset.search.toLocaleLowerCase().includes(query);
    if (!slide.hidden) count++;
  }
  result.textContent = query ? `找到 ${count} 頁` : '完整收錄 40 頁';
  document.querySelector('#empty').hidden = count !== 0;
}
search.addEventListener('input', filterSlides);
function revealHash() {
  const target = slides.find(slide => `#${slide.id}` === location.hash);
  if (target && target.hidden) {
    search.value = '';
    filterSlides();
    target.scrollIntoView();
  }
}
window.addEventListener('hashchange', revealHash);
document.addEventListener('keydown', event => {
  if (event.target.closest('input,textarea,select,button,summary,a,[contenteditable]') || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const visible = slides.filter(slide => !slide.hidden);
  if (!visible.length) return;
  const current = visible.reduce((best, slide, index) => Math.abs(slide.getBoundingClientRect().top - 96) < Math.abs(visible[best].getBoundingClientRect().top - 96) ? index : best, 0);
  const next = Math.max(0, Math.min(visible.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
  event.preventDefault();
  location.hash = visible[next].id;
});
document.querySelector('#top').addEventListener('click', () => { location.hash = 'slide-1'; window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); });
