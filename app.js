'use strict';
const slides = [...document.querySelectorAll('.slide')];
const search = document.querySelector('#search');
const result = document.querySelector('#result');
const jump = document.querySelector('#jump');
const panel = document.querySelector('#guide-nav');
const toggle = document.querySelector('#search-toggle');
const savedToggle = document.querySelector('#saved-toggle');
const resultList = document.querySelector('#search-results');
const clearButton = document.querySelector('#clear-search');
const readProgress = document.querySelector('#reading-progress');
const backTop = document.querySelector('#back-top');
const notice = document.querySelector('#notice');
const aliases = new Map(Object.entries({istanbul:'伊斯坦堡',goreme:'格雷梅',cappadocia:'卡帕多奇亞',safranbolu:'番紅花城',antalya:'安塔利亞',pamukkale:'棉堡',ephesus:'以弗所',ankara:'安卡拉',selcuk:'塞爾丘克',fethiye:'費特希耶'}));
const fold = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/ı/g,'i');
const canonical = value => { let text = fold(value); for (const [alias, city] of aliases) text = text.replaceAll(alias, city); return text; };
const index = new Map(slides.map(slide => [slide, canonical(slide.dataset.search)]));
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(`turkey-${key}`)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`turkey-${key}`, JSON.stringify(value)); return true; } catch { return false; } }
};
const storedSaved = storage.get('saved', []);
const saved = new Set((Array.isArray(storedSaved) ? storedSaved : []).filter(id => slides.some(slide => slide.id === id && slide.classList.contains('day'))));
let onlySaved = false;
let current = slides[0];
let noticeTimer;
function announce(message) { notice.textContent = message; notice.classList.add('visible'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => notice.classList.remove('visible'), 3500); }
function clearHighlights() { for (const mark of document.querySelectorAll('mark.search-hit')) { const parent = mark.parentNode; mark.replaceWith(document.createTextNode(mark.textContent)); parent.normalize(); } }
function highlight(query) {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(fold).filter(Boolean);
  if (!terms.length) return;
  for (const slide of slides.filter(item => !item.hidden)) {
    for (const element of slide.querySelectorAll('h2,h3,h4,p, .overview strong')) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const original = node.textContent; let normalized = ''; const positions = [];
        for (let i=0; i<original.length; i++) { const part=fold(original[i]); normalized+=part; positions.push(...Array(part.length).fill(i)); }
        const ranges=[];
        for (const term of terms) { let at=normalized.indexOf(term); while (at>=0) { ranges.push([positions[at],positions[at+term.length-1]+1]); at=normalized.indexOf(term,at+term.length); } }
        ranges.sort((a,b)=>a[0]-b[0]); const merged=[];
        for (const range of ranges) { const last=merged.at(-1); if (last && range[0]<=last[1]) last[1]=Math.max(last[1],range[1]); else merged.push(range); }
        if (!merged.length) continue;
        const fragment=document.createDocumentFragment();let cursor=0;
        for (const [start,end] of merged) { fragment.append(original.slice(cursor,start)); const mark=document.createElement('mark');mark.className='search-hit';mark.textContent=original.slice(start,end);fragment.append(mark);cursor=end; }
        fragment.append(original.slice(cursor));node.replaceWith(fragment);
      }
    }
  }
}
function syncQuery() { const url = new URL(location.href); if (search.value.trim()) url.searchParams.set('q', search.value.trim()); else url.searchParams.delete('q'); try { history.replaceState(null, '', url); } catch { /* Direct file previews may restrict URL updates. */ } }
function filterSlides({sync=true}={}) {
  clearHighlights();
  const query = search.value.trim(); const terms=canonical(query).split(/\s+/).filter(Boolean);
  const matches=[];
  for (const slide of slides) {
    slide.hidden = (onlySaved && !saved.has(slide.id)) || !terms.every(term => index.get(slide).includes(term));
    if (!slide.hidden) matches.push(slide);
  }
  result.textContent = query || onlySaved ? `找到 ${matches.length} 頁${onlySaved ? '收藏' : '相關'}內容` : '完整收錄 19 天 · 40 頁原稿';
  clearButton.disabled = !query && !onlySaved;
  document.querySelector('#empty').hidden = matches.length !== 0;
  resultList.replaceChildren(); resultList.hidden = !query && !onlySaved;
  for (const slide of matches) {
    const li=document.createElement('li');const a=document.createElement('a');a.href=`#${slide.id}`;a.textContent=slide.querySelector('h1,h2').textContent;li.append(a);resultList.append(li);
  }
  highlight(query);
  if (sync) syncQuery();
}
function clearSearch() { search.value = ''; onlySaved=false;savedToggle.setAttribute('aria-pressed','false');filterSlides(); }
function openSearch(open) {
  panel.classList.toggle('is-open', open);toggle.setAttribute('aria-expanded', String(open));toggle.textContent = open ? '關閉' : '搜尋';
  if (open) search.focus({preventScroll: true});
}
search.addEventListener('input', () => filterSlides());
clearButton.addEventListener('click', () => { clearSearch(); search.focus(); });
document.querySelector('#reset-search').addEventListener('click', () => { clearSearch(); openSearch(true); });
toggle.addEventListener('click', () => openSearch(toggle.getAttribute('aria-expanded') !== 'true'));
savedToggle.addEventListener('click',()=>{onlySaved=!onlySaved;savedToggle.setAttribute('aria-pressed',String(onlySaved));filterSlides();});
function updateSaved() {
  for (const button of document.querySelectorAll('.save-day')) { const selected=saved.has(button.dataset.id);button.setAttribute('aria-pressed',String(selected));button.textContent=selected?'已收藏':'收藏這一天'; }
  savedToggle.textContent=`只看收藏${saved.size ? ` (${saved.size})` : ''}`;
}
for (const button of document.querySelectorAll('.save-day')) button.addEventListener('click',()=>{
  if (saved.has(button.dataset.id)) saved.delete(button.dataset.id); else saved.add(button.dataset.id);
  const persisted=storage.set('saved',[...saved]);updateSaved();if (onlySaved) filterSlides();announce(persisted?'已更新收藏，保存在此裝置':'已更新收藏，本次瀏覽期間有效');
});
for (const button of document.querySelectorAll('.share-day')) button.addEventListener('click',async()=>{
  const url=new URL(location.href);url.search='';url.hash=button.dataset.id;
  try { await navigator.clipboard.writeText(url.href);announce('已複製當日連結'); }
  catch { const field=document.createElement('input');field.value=url.href;field.readOnly=true;field.className='share-fallback';button.after(field);field.focus();field.select();announce('請複製下方選取的連結');field.addEventListener('blur',()=>field.remove(),{once:true}); }
});
function navigateToHash({focus=true}={}) {
  let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);if (!target) return;
  const article=target.closest('.slide');if (article?.hidden) clearSearch();
  openSearch(false);
  if (article && [...jump.options].some(option => option.value === article.id)) jump.value=article.id;
  if (focus) target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
}
jump.addEventListener('change',()=>{ const id=jump.value;clearSearch();openSearch(false);if(location.hash===`#${id}`)navigateToHash();else location.hash=id; });
window.addEventListener('hashchange',()=>navigateToHash());
document.addEventListener('click',event=>{
  const anchor=event.target.closest('a[href^="#"]');if(!anchor)return;
  const id=anchor.hash.slice(1);const target=document.getElementById(id);if(!target)return;
  if (target.closest('.slide')?.hidden) clearSearch();
  if(location.hash===anchor.hash){event.preventDefault();navigateToHash();}
});
document.addEventListener('keydown',event=>{
  const editing=event.target.closest('input,textarea,select,[contenteditable]');
  if(event.key==='Escape' && panel.classList.contains('is-open')){openSearch(false);if(matchMedia('(max-width:900px)').matches)toggle.focus();else search.blur();return;}
  if(event.key==='/' && !editing && !event.metaKey && !event.ctrlKey){event.preventDefault();openSearch(true);return;}
  if(editing || event.target.closest('button,summary,a') || event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft','ArrowRight'].includes(event.key))return;
  const visible=slides.filter(slide=>!slide.hidden);if(!visible.length)return;
  const at=Math.max(0,visible.indexOf(current));const next=Math.max(0,Math.min(visible.length-1,at+(event.key==='ArrowRight'?1:-1)));
  event.preventDefault();location.hash=visible[next].id;
});
const sectionLinks=[...document.querySelectorAll('aside nav a')];
function setCurrent(slide){
  current=slide;jump.value=slide.id;
  const at=slides.indexOf(slide);const active=sectionLinks.filter(a=>slides.indexOf(document.querySelector(a.hash))<=at).at(-1);
  for(const anchor of sectionLinks){if(anchor===active)anchor.setAttribute('aria-current','location');else anchor.removeAttribute('aria-current');}
  if(slide.classList.contains('day'))storage.set('resume',{id:slide.id,title:slide.querySelector('h2').textContent});
}
const intersecting=new Set();
const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){if(entry.isIntersecting)intersecting.add(entry.target);else intersecting.delete(entry.target);}
  const available=[...intersecting].filter(slide=>!slide.hidden).sort((a,b)=>slides.indexOf(a)-slides.indexOf(b));
  if(available.length)setCurrent(available[0]);
},{rootMargin:'-140px 0px -55% 0px',threshold:0});
slides.forEach(slide=>observer.observe(slide));
let scrollScheduled=false;
function updateProgress(){const total=document.documentElement.scrollHeight-innerHeight;readProgress.style.transform=`scaleX(${total>0?Math.max(0,Math.min(1,scrollY/total)):0})`;backTop.hidden=scrollY<innerHeight;}
window.addEventListener('scroll',()=>{if(scrollScheduled)return;scrollScheduled=true;requestAnimationFrame(()=>{scrollScheduled=false;updateProgress();});},{passive:true});
function updateStickyOffsets(){
  const header=document.querySelector('header');const toolbar=document.querySelector('.mobile-toolbar');
  const bottom=header.offsetHeight+(getComputedStyle(toolbar).display==='none'?0:toolbar.offsetHeight);
  document.documentElement.style.setProperty('--panel-top',`${bottom}px`);
  document.documentElement.style.setProperty('--anchor-offset',`${bottom+16}px`);
  updateProgress();
}
new ResizeObserver(updateStickyOffsets).observe(document.querySelector('header'));
new ResizeObserver(updateStickyOffsets).observe(document.querySelector('.mobile-toolbar'));
window.addEventListener('resize',updateStickyOffsets);
updateStickyOffsets();
backTop.addEventListener('click',()=>{clearSearch();location.hash='slide-1';navigateToHash();});
const resume=storage.get('resume',null);
if(!location.hash && resume && document.getElementById(resume.id)){document.querySelector('#resume').hidden=false;document.querySelector('#resume-label').textContent=`上次讀到：${resume.title}`;document.querySelector('#resume-link').href=`#${resume.id}`;}
document.querySelector('#dismiss-resume').addEventListener('click',()=>{document.querySelector('#resume').hidden=true;storage.set('resume',null);});
const checks=[...document.querySelectorAll('.prep-check')];
function updatePrep(){const count=checks.filter(check=>check.checked).length;document.querySelector('#prep-progress').textContent=`已完成 ${count} / ${checks.length} 項`;for(const check of checks)check.closest('.prep-item').classList.toggle('completed',check.checked);}
for(const check of checks){check.checked=storage.get(check.dataset.key,false)===true;check.addEventListener('change',()=>{const persisted=storage.set(check.dataset.key,check.checked);updatePrep();if(!persisted)announce('本次瀏覽期間會保留勾選狀態');});}
document.querySelector('#reset-prep').addEventListener('click',()=>{for(const check of checks){check.checked=false;storage.set(check.dataset.key,false);}updatePrep();announce('已重設準備清單');});
const fontToggle=document.querySelector('#font-toggle');
function setLargeText(large){document.documentElement.classList.toggle('large-text',large);fontToggle.setAttribute('aria-pressed',String(large));fontToggle.textContent=large?'標準文字':'放大文字';}
setLargeText(storage.get('large-text',false)===true);
fontToggle.addEventListener('click',()=>{const large=!document.documentElement.classList.contains('large-text');setLargeText(large);storage.set('large-text',large);});
for(const image of document.querySelectorAll('img')) image.addEventListener('error',()=>{image.hidden=true;const fallback=document.createElement('span');fallback.className='image-error';fallback.textContent=`圖片暫時無法載入：${image.alt}。可繼續閱讀文字行程。`;image.closest('picture')?.after(fallback);},{once:true});
search.value=new URL(location.href).searchParams.get('q') || '';
if(search.value)openSearch(true);
filterSlides({sync:false});updateSaved();updatePrep();updateProgress();
if(location.hash && !search.value)navigateToHash({focus:false});
