/* Progressive enhancement; the static itinerary remains readable without this file. */
(function () {
  'use strict';
  const core = window.GuideCore;
  if (!core) { document.documentElement.classList.remove('js'); return; }
  const $ = selector => document.querySelector(selector);
  const slides = [...document.querySelectorAll('.slide')];
  const byId = new Map(slides.map(slide => [slide.id, slide]));
  const search = $('#search');
  const result = $('#result');
  const resultList = $('#search-results');
  const panel = $('#guide-nav');
  const toggle = $('#search-toggle');
  const clearButton = $('#clear-search');
  const backdrop = $('#search-backdrop');
  const tripMenu = $('#trip-menu');
  const jumpToggle = $('#jump-toggle');
  const desktopMenu = $('#desktop-menu');
  const menuSearch = $('#menu-search');
  const menuBody = tripMenu.querySelector('.menu-body');
  const menuLinks = [...tripMenu.querySelectorAll('[data-menu-item]')];
  const mobile = matchMedia('(max-width:900px)');
  const records = slides.map((slide, order) => {
    const title = slide.querySelector('h1,h2').textContent.trim();
    const meta = slide.querySelector('.day-label')?.textContent.trim() || slide.dataset.kindLabel;
    const parts = [...slide.querySelectorAll('.travel-notes li,.sight p,.food-list p,.transport-list p,.stay p,.chapter-summary')].map(el=>el.textContent.trim());
    return {id:slide.id, element:slide, order, title:core.normalize(title), titleText:title, meta:core.normalize(meta), metaText:meta, kind:slide.dataset.kind, kindLabel:slide.dataset.kindLabel, search:core.normalize(slide.dataset.search), parts};
  });
  const menuRecords = menuLinks.map((link, order) => {
    const id=core.hashId(link.hash);const meta=byId.get(id)?.querySelector('.day-label')?.textContent || '';
    return {id,element:link,order,kind:link.dataset.kind,title:core.normalize(link.textContent),meta:core.normalize(meta),search:core.normalize(link.textContent+' '+meta+' '+(byId.get(id)?.dataset.search||''))};
  });
  const memory = new Map();
  const storage = {
    get(key, fallback) { try { const raw=localStorage.getItem(`turkey-${key}`);return raw===null?(memory.get(key)??fallback):JSON.parse(raw); } catch { return memory.get(key)??fallback; } },
    set(key, value) { memory.set(key,value);try {localStorage.setItem(`turkey-${key}`,JSON.stringify(value));return true;}catch{return false;} }
  };
  let current = slides[0];
  let searchKind = 'all';
  let menuKind = 'all';
  let matches = records;
  let composing = false;
  let searchTimer;
  let noticeTimer;
  let lastFilterKey;
  let menuScroll = 0;
  let menuOpener = jumpToggle;
  let menuDestination = null;
  let navigationId = null;
  let navigationTimer;
  let observer;
  let readingBand = 140;
  let observed = new Set();
  const notice = $('#notice');
  function announce(message) {
    notice.textContent=message;notice.classList.add('visible');clearTimeout(noticeTimer);
    noticeTimer=setTimeout(()=>notice.classList.remove('visible'),3500);
  }
  function setPressed(attribute,value) {
    for(const button of document.querySelectorAll(`[${attribute}]`))button.setAttribute('aria-pressed',String(button.getAttribute(attribute)===value));
  }
  function clearHighlights() {
    for(const mark of document.querySelectorAll('mark.search-hit')){const parent=mark.parentNode;mark.replaceWith(document.createTextNode(mark.textContent));parent.normalize();}
  }
  function highlight(query) {
    const terms=core.terms(query).filter(Boolean);
    if(!terms.length)return;
    for(const record of matches){
      const walker=document.createTreeWalker(record.element,NodeFilter.SHOW_TEXT,{acceptNode(node){
        const parent=node.parentElement;
        if(!parent||parent.closest('.sr-only,button,script,style,mark,.map-link'))return NodeFilter.FILTER_REJECT;
        return parent.closest('h2,h3,h4,p,li,dd,dt,.overview strong')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
      }});
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
      for(const node of nodes){
        const original=node.textContent;let folded='';const positions=[];
        for(let i=0;i<original.length;i++){const part=core.fold(original[i]);folded+=part;positions.push(...Array(part.length).fill(i));}
        const ranges=[];
        for(const term of terms){let at=folded.indexOf(term);while(at>=0){ranges.push([positions[at],positions[at+term.length-1]+1]);at=folded.indexOf(term,at+term.length);}}
        ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
        for(const range of ranges){const previous=merged.at(-1);if(previous&&range[0]<=previous[1])previous[1]=Math.max(previous[1],range[1]);else merged.push(range);}
        if(!merged.length)continue;
        const fragment=document.createDocumentFragment();let cursor=0;
        for(const [start,end] of merged){fragment.append(original.slice(cursor,start));const mark=document.createElement('mark');mark.className='search-hit';mark.textContent=original.slice(start,end);fragment.append(mark);cursor=end;}
        fragment.append(original.slice(cursor));node.replaceWith(fragment);
      }
    }
  }
  function syncQuery() {
    const url=new URL(location.href);
    const query=search.value.trim();
    if(query)url.searchParams.set('q',query);else url.searchParams.delete('q');
    if(searchKind!=='all')url.searchParams.set('kind',searchKind);else url.searchParams.delete('kind');
    try{history.replaceState(null,'',url);}catch{/* A direct file preview may restrict history. */}
  }
  function renderResults(query) {
    resultList.replaceChildren();resultList.hidden=!query&&searchKind==='all';
    if(resultList.hidden)return;
    const fragment=document.createDocumentFragment();
    for(const record of matches){
      const li=document.createElement('li');const a=document.createElement('a');a.href=`#${record.id}`;
      const meta=document.createElement('span');meta.className='result-meta';meta.textContent=record.metaText;
      const title=document.createElement('strong');title.textContent=record.titleText;
      a.append(meta,title);
      const excerpt=core.snippet(record.parts,query);
      if(excerpt){const snippet=document.createElement('span');snippet.className='result-snippet';snippet.textContent=excerpt;a.append(snippet);}
      li.append(a);fragment.append(li);
    }
    resultList.append(fragment);
  }
  function filterSlides({sync=true,force=false}={}) {
    clearTimeout(searchTimer);
    search.value=core.boundedQuery(search.value);
    const query=search.value.trim();const key=`${query}\0${searchKind}`;
    if(!force&&lastFilterKey===key){if(sync)syncQuery();return;}
    lastFilterKey=key;clearHighlights();matches=core.search(records,query,searchKind);
    const ids=new Set(matches.map(record=>record.id));
    for(const slide of slides)slide.hidden=!ids.has(slide.id);
    result.textContent=query||searchKind!=='all'?`找到 ${matches.length} 項相關內容`:'19 天行程・美食・交通準備';
    clearButton.disabled=!query&&searchKind==='all';
    $('#search-suggestions').hidden=Boolean(query)||searchKind!=='all';
    $('#empty').hidden=matches.length!==0;
    renderResults(query);highlight(query);setPressed('data-search-kind',searchKind);
    if(sync)syncQuery();
    refreshObserver();updateProgress();
  }
  function clearSearch(){search.value='';searchKind='all';filterSlides();}
  function openSearch(open,{focus=true}={}) {
    if(open&&tripMenu.open)closeMenu();
    panel.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));
    toggle.querySelector('span').textContent=open?'關閉':'搜尋';
    backdrop.hidden=!open||!mobile.matches;
    if(open&&focus)search.focus({preventScroll:true});
  }
  search.addEventListener('compositionstart',()=>{composing=true;clearTimeout(searchTimer);});
  search.addEventListener('compositionend',()=>{composing=false;filterSlides();});
  search.addEventListener('input',()=>{if(composing)return;clearTimeout(searchTimer);searchTimer=setTimeout(filterSlides,120);});
  search.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();filterSlides();const first=resultList.querySelector('a');if(first)first.click();}});
  clearButton.addEventListener('click',()=>{clearSearch();search.focus();});
  $('#reset-search').addEventListener('click',()=>{clearSearch();openSearch(true);});
  toggle.addEventListener('click',()=>openSearch(!panel.classList.contains('is-open')));
  backdrop.addEventListener('click',()=>{openSearch(false);toggle.focus({preventScroll:true});});
  for(const button of document.querySelectorAll('[data-search-kind]'))button.addEventListener('click',()=>{searchKind=button.dataset.searchKind;filterSlides();});
  for(const button of document.querySelectorAll('[data-query]'))button.addEventListener('click',()=>{search.value=button.dataset.query;searchKind='all';filterSlides();search.focus();});
  function updateJump(slide) {
    const date=slide.querySelector('.day-label');
    $('#jump-label').textContent=date?date.childNodes[0].textContent.trim():'旅程目錄';
    $('#jump-subtitle').textContent=slide.querySelector('h1,h2').textContent.trim();
    for(const anchor of menuLinks){if(anchor.hash===`#${slide.id}`)anchor.setAttribute('aria-current','page');else anchor.removeAttribute('aria-current');}
  }
  function filterMenu() {
    menuSearch.value=core.boundedQuery(menuSearch.value);
    const ids=new Set(core.search(menuRecords,menuSearch.value,menuKind).map(record=>record.id));
    for(const link of menuLinks){const show=ids.has(core.hashId(link.hash));link.hidden=!show;if(link.parentElement.tagName==='LI')link.parentElement.hidden=!show;}
    for(const group of tripMenu.querySelectorAll('.menu-group'))group.hidden=![...group.querySelectorAll('[data-menu-item]')].some(item=>!item.hidden);
    $('#menu-count').textContent=`${ids.size} 個章節`;
    $('#menu-empty').hidden=ids.size!==0;$('#menu-clear').disabled=!menuSearch.value&&menuKind==='all';
    setPressed('data-menu-kind',menuKind);
  }
  function resetMenu(){menuSearch.value='';menuKind='all';filterMenu();menuBody.scrollTop=0;}
  function closeMenu(){if(tripMenu.open)tripMenu.close();}
  function openMenu(opener) {
    if(typeof tripMenu.showModal!=='function'){location.hash='slide-4';navigateToHash();return;}
    openSearch(false);menuOpener=opener;menuDestination=null;
    filterMenu();tripMenu.showModal();document.documentElement.classList.add('menu-open');
    for(const button of [jumpToggle,desktopMenu])button.setAttribute('aria-expanded','true');
    $('#close-menu').focus({preventScroll:true});
    requestAnimationFrame(()=>{
      if(menuScroll>0)menuBody.scrollTop=menuScroll;
      else {const active=tripMenu.querySelector('[aria-current="page"]:not([hidden])');if(active)active.scrollIntoView({block:'center',behavior:'instant'});}
    });
  }
  jumpToggle.addEventListener('click',()=>openMenu(jumpToggle));desktopMenu.addEventListener('click',()=>openMenu(desktopMenu));
  $('#close-menu').addEventListener('click',closeMenu);
  tripMenu.addEventListener('click',event=>{
    const anchor=event.target.closest('[data-menu-item]');
    if(anchor){event.preventDefault();menuDestination=core.hashId(anchor.hash);clearSearch();closeMenu();return;}
    if(event.target===tripMenu){const rect=tripMenu.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeMenu();}
  });
  tripMenu.addEventListener('close',()=>{
    menuScroll=menuBody.scrollTop;document.documentElement.classList.remove('menu-open');
    for(const button of [jumpToggle,desktopMenu])button.setAttribute('aria-expanded','false');
    if(menuDestination){const destination=menuDestination;menuDestination=null;goTo(destination);}
    else if(menuOpener?.isConnected)menuOpener.focus({preventScroll:true});
  });
  menuSearch.addEventListener('input',()=>{filterMenu();menuBody.scrollTop=0;});
  menuSearch.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();const first=menuLinks.find(link=>!link.hidden);if(first)first.click();}});
  $('#menu-clear').addEventListener('click',()=>{resetMenu();menuSearch.focus();});
  $('#menu-reset').addEventListener('click',()=>{resetMenu();menuSearch.focus();});
  for(const button of document.querySelectorAll('[data-menu-kind]'))button.addEventListener('click',()=>{menuKind=button.dataset.menuKind;filterMenu();menuBody.scrollTop=0;});
  function goTo(id){if(location.hash===`#${id}`)navigateToHash();else location.hash=id;}
  function navigateToHash({focus=true}={}) {
    const id=core.hashId(location.hash);const target=id?document.getElementById(id):null;if(!target)return;
    const article=target.closest('.slide');if(article?.hidden)clearSearch();
    openSearch(false);updateStickyOffsets();
    if(article){setCurrent(article);navigationId=article.id;clearTimeout(navigationTimer);navigationTimer=setTimeout(()=>{navigationId=null;},300);}
    if(focus)target.focus({preventScroll:true});
    target.scrollIntoView({block:'start',behavior:'instant'});
  }
  let ignoredHistoryHash=null;
  window.addEventListener('hashchange',()=>{if(ignoredHistoryHash===location.hash){ignoredHistoryHash=null;return;}ignoredHistoryHash=null;navigateToHash();});
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href^="#"]');if(!anchor||anchor.closest('#trip-menu'))return;
    const id=core.hashId(anchor.hash);const target=id?document.getElementById(id):null;if(!target)return;
    if(target.closest('.slide')?.hidden)clearSearch();
    if(location.hash===anchor.hash){event.preventDefault();navigateToHash();}
  });
  function restoreQuery(){const url=new URL(location.href);search.value=core.boundedQuery(url.searchParams.get('q')||'');searchKind=core.selectedKind(url.searchParams.get('kind'));filterSlides({sync:false});}
  window.addEventListener('popstate',()=>{
    restoreQuery();const target=byId.get(core.hashId(location.hash));
    if((search.value||searchKind!=='all')&&(!target||target.hidden)){ignoredHistoryHash=location.hash;openSearch(true,{focus:false});return;}
    if(location.hash)navigateToHash({focus:false});
  });
  document.addEventListener('keydown',event=>{
    if(tripMenu.open)return;
    const editing=event.target.closest('input,textarea,select,[contenteditable]');
    if(event.key==='Escape'&&panel.classList.contains('is-open')){openSearch(false);if(mobile.matches)toggle.focus();else search.blur();return;}
    if(!editing&&!event.metaKey&&!event.ctrlKey&&['/','m','M'].includes(event.key)){event.preventDefault();if(event.key==='/')openSearch(true);else openMenu(mobile.matches?jumpToggle:desktopMenu);return;}
    if(editing||event.target.closest('button,summary,a')||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    const visible=slides.filter(slide=>!slide.hidden);if(!visible.length)return;
    const index=Math.max(0,visible.indexOf(current));const next=Math.max(0,Math.min(visible.length-1,index+(event.key==='ArrowRight'?1:-1)));
    event.preventDefault();goTo(visible[next].id);
  });
  const sectionLinks=[...document.querySelectorAll('aside nav a')];
  const sectionPositions=sectionLinks.map(link=>({link,order:slides.indexOf(byId.get(core.hashId(link.hash)))}));
  let lastCurrent;
  function setCurrent(slide) {
    if(slide===lastCurrent)return;lastCurrent=slide;current=slide;updateJump(slide);
    const at=slides.indexOf(slide);const active=sectionPositions.filter(item=>item.order<=at).at(-1)?.link;
    for(const anchor of sectionLinks){if(anchor===active)anchor.setAttribute('aria-current','location');else anchor.removeAttribute('aria-current');}
    if(slide.classList.contains('day'))storage.set('resume',{id:slide.id});
  }
  function refreshObserver(){if(!observer)return;observer.disconnect();observed=new Set();for(const slide of slides)if(!slide.hidden)observer.observe(slide);}
  function createObserver() {
    observer?.disconnect();observed=new Set();
    if(!('IntersectionObserver' in window))return;
    observer=new IntersectionObserver(entries=>{
      for(const entry of entries){if(entry.isIntersecting)observed.add(entry.target);else observed.delete(entry.target);}
      if(navigationId||tripMenu.open)return;
      const available=[...observed].filter(slide=>!slide.hidden).sort((a,b)=>slides.indexOf(a)-slides.indexOf(b));
      if(available.length)setCurrent(available[0]);
    },{rootMargin:`-${readingBand}px 0px -45% 0px`,threshold:0});
    refreshObserver();
  }
  let scrollScheduled=false;
  function updateProgress(){const total=document.documentElement.scrollHeight-innerHeight;$('#reading-progress').style.transform=`scaleX(${total>0?Math.max(0,Math.min(1,scrollY/total)):0})`;$('#back-top').hidden=scrollY<innerHeight;}
  window.addEventListener('scroll',()=>{
    if(scrollScheduled)return;scrollScheduled=true;
    requestAnimationFrame(()=>{scrollScheduled=false;updateProgress();if(!observer&&!navigationId){const active=slides.filter(slide=>!slide.hidden&&slide.getBoundingClientRect().top<=readingBand).at(-1);if(active)setCurrent(active);}});
  },{passive:true});
  function updateStickyOffsets() {
    const header=document.querySelector('header');const toolbar=$('.mobile-toolbar');
    const headerStyle=getComputedStyle(header);
    const headerHeight=['sticky','fixed'].includes(headerStyle.position)?header.offsetHeight:0;
    const bottom=headerHeight+(getComputedStyle(toolbar).display==='none'?0:toolbar.offsetHeight);
    document.documentElement.style.setProperty('--panel-top',`${bottom}px`);document.documentElement.style.setProperty('--anchor-offset',`${bottom+16}px`);
    const nextBand=Math.ceil(Math.min(bottom+20,innerHeight*.45));if(readingBand!==nextBand){readingBand=nextBand;createObserver();}updateProgress();
  }
  if('ResizeObserver' in window){const resize=new ResizeObserver(updateStickyOffsets);resize.observe(document.querySelector('header'));resize.observe($('.mobile-toolbar'));}
  window.addEventListener('resize',updateStickyOffsets);
  const breakpointChange=()=>{openSearch(false,{focus:false});updateStickyOffsets();};
  if(mobile.addEventListener)mobile.addEventListener('change',breakpointChange);else mobile.addListener(breakpointChange);
  $('#back-top').addEventListener('click',()=>{clearSearch();goTo('slide-1');});
  const resumeId=core.safeResume(storage.get('resume',null),new Set(records.filter(record=>record.kind==='day').map(record=>record.id)));
  if(!location.hash&&resumeId){$('#resume').hidden=false;$('#resume-label').textContent=`上次讀到：${byId.get(resumeId).querySelector('h2').textContent}`;$('#resume-link').href=`#${resumeId}`;}
  $('#dismiss-resume').addEventListener('click',()=>{$('#resume').hidden=true;storage.set('resume',null);});
  const checks=[...document.querySelectorAll('.prep-check')];
  function updatePrep(){const count=checks.filter(check=>check.checked).length;$('#prep-progress').textContent=`已完成 ${count} / ${checks.length} 項`;for(const check of checks)check.closest('.prep-item').classList.toggle('completed',check.checked);$('#reset-prep').disabled=count===0;}
  for(const check of checks){check.checked=storage.get(check.dataset.key,false)===true;check.addEventListener('change',()=>{const persisted=storage.set(check.dataset.key,check.checked);updatePrep();if(!persisted)announce('本次瀏覽期間會保留勾選狀態');});}
  $('#reset-prep').addEventListener('click',()=>{for(const check of checks){check.checked=false;storage.set(check.dataset.key,false);}updatePrep();announce('已重設準備清單');});
  const fontToggle=$('#font-toggle');
  function setLargeText(large){document.documentElement.classList.toggle('large-text',large);fontToggle.setAttribute('aria-pressed',String(large));fontToggle.textContent=large?'標準文字':'放大文字';updateStickyOffsets();}
  fontToggle.addEventListener('click',()=>{const large=!document.documentElement.classList.contains('large-text');setLargeText(large);storage.set('large-text',large);});
  function imageFailure(image){if(image.dataset.failed)return;image.dataset.failed='true';image.hidden=true;const fallback=document.createElement('p');fallback.className='image-error';fallback.textContent='插畫暫時無法載入，文字行程仍可閱讀。';image.after(fallback);}
  for(const image of document.querySelectorAll('img')){image.addEventListener('error',()=>imageFailure(image),{once:true});if(image.complete&&image.naturalWidth===0)imageFailure(image);}
  window.addEventListener('beforeprint',()=>document.documentElement.classList.add('printing'));
  window.addEventListener('afterprint',()=>document.documentElement.classList.remove('printing'));
  setLargeText(storage.get('large-text',false)===true);restoreQuery();filterMenu();updatePrep();updateStickyOffsets();createObserver();setCurrent(slides[0]);
  if(search.value||searchKind!=='all')openSearch(true,{focus:false});
  if(location.hash&&!search.value){navigateToHash({focus:false});window.addEventListener('load',()=>navigateToHash({focus:false}),{once:true});}
})();
