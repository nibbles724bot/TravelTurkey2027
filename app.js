'use strict';
const slides = [...document.querySelectorAll('.slide')];
const search = document.querySelector('#search');
const result = document.querySelector('#result');
const jump = document.querySelector('#jump');
const panel = document.querySelector('#guide-nav');
const toggle = document.querySelector('#search-toggle');
function filterSlides() {
  const query = search.value.trim().toLocaleLowerCase();
  let count = 0;
  for (const slide of slides) {
    slide.hidden = !slide.dataset.search.toLocaleLowerCase().includes(query);
    if (!slide.hidden) count++;
  }
  result.textContent = query ? `找到 ${count} 頁相關內容` : '完整收錄 19 天 · 40 頁原稿';
  document.querySelector('#empty').hidden = count !== 0;
}
function clearSearch() { search.value = ''; filterSlides(); }
function openSearch(open) {
  panel.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? '收起' : '搜尋';
  if (open) { panel.scrollIntoView({block: 'start'}); search.focus({preventScroll: true}); }
}
search.addEventListener('input', filterSlides);
document.querySelector('#clear-search').addEventListener('click', () => { clearSearch(); search.focus(); });
document.querySelector('#reset-search').addEventListener('click', () => { clearSearch(); openSearch(true); });
toggle.addEventListener('click', () => openSearch(toggle.getAttribute('aria-expanded') !== 'true'));
function revealHash() {
  const target = slides.find(slide => `#${slide.id}` === location.hash);
  if (!target) return;
  if (target.hidden) clearSearch();
  if ([...jump.options].some(option => option.value === target.id)) jump.value = target.id;
  target.scrollIntoView({block: 'start'});
}
jump.addEventListener('change', () => {
  clearSearch(); openSearch(false);
  if (location.hash === `#${jump.value}`) revealHash();
  else location.hash = jump.value;
});
window.addEventListener('hashchange', revealHash);
if (location.hash) revealHash();
document.addEventListener('keydown', event => {
  if (event.target.closest('input,textarea,select,button,summary,a,[contenteditable]') || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const visible = slides.filter(slide => !slide.hidden);
  if (!visible.length) return;
  const offset = matchMedia('(max-width: 900px)').matches ? 136 : 96;
  const current = visible.reduce((best, slide, index) => Math.abs(slide.getBoundingClientRect().top - offset) < Math.abs(visible[best].getBoundingClientRect().top - offset) ? index : best, 0);
  const next = Math.max(0, Math.min(visible.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
  event.preventDefault();
  location.hash = visible[next].id;
});
// Keep the date selector in sync with the page being read, without changing history.
let scrollScheduled = false;
window.addEventListener('scroll', () => {
  if (scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(() => {
    scrollScheduled = false;
    const offset = matchMedia('(max-width: 900px)').matches ? 150 : 110;
    const current = slides.filter(slide => !slide.hidden && slide.getBoundingClientRect().top <= offset).at(-1);
    if (!current) return;
    const option = [...jump.options].find(item => item.value === current.id);
    if (option) jump.value = option.value;
    for (const anchor of document.querySelectorAll('nav a')) {
      if (anchor.hash === `#${current.id}`) anchor.setAttribute('aria-current', 'location');
      else anchor.removeAttribute('aria-current');
    }
  });
}, {passive: true});
