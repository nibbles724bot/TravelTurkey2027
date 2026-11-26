/* Shared, dependency-free search and navigation rules. Also usable in Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GuideCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_QUERY = 120;
  const aliases = [
    ['热气球','熱氣球'],['蓝色潟湖','藍色潟湖'],['机场','機場'],['火车','火車'],['住宿区','住宿區'],['istanbul','伊斯坦堡'],['伊斯坦布爾','伊斯坦堡'],['伊斯坦布尔','伊斯坦堡'],
    ['goreme','格雷梅'],['cappadocia','卡帕多奇亞'],['卡帕多奇亚','卡帕多奇亞'],
    ['safranbolu','番紅花城'],['番红花城','番紅花城'],['antalya','安塔利亞'],['安塔利亚','安塔利亞'],
    ['pamukkale','棉堡'],['ephesus','以弗所'],['ankara','安卡拉'],
    ['selcuk','塞爾丘克'],['塞尔丘克','塞爾丘克'],['fethiye','費特希耶'],['费特希耶','費特希耶'],
    ['kas','卡什'],['izmir','伊茲密爾'],['denizli','代尼茲利'],['uchisar','烏奇沙'],['sirince','希林傑'],['oludeniz','歐魯旦尼斯'],['欧鲁旦尼斯','歐魯旦尼斯'],['nemrut','內姆魯特'],['内姆鲁特','內姆魯特']
  ];
  function fold(value) {
    return String(value ?? '').normalize('NFKC').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/ı/g,'i');
  }
  function boundedQuery(value) { return String(value ?? '').slice(0, MAX_QUERY); }
  function normalize(value) {
    let text = fold(value).replace(/\bday\s*0*(\d{1,2})\b/g,(_,n)=>`day${Number(n)}`)
      .replace(/\b0?(\d{1,2})\s*[/-]\s*0?(\d{1,2})\b/g,(_,m,d)=>`${Number(m)}/${Number(d)}`);
    for (const [alias,city] of aliases) text=text.replaceAll(alias,city);
    return text.replace(/[，、,；;｜|＋+。:：()（）「」“”"'!?！？→↔⇄✈]/g,' ').replace(/\s+/g,' ').trim();
  }
  function terms(query) { return [...new Set(normalize(boundedQuery(query)).split(' ').filter(Boolean))]; }
  function contains(text, term) {
    if (/^day\d{1,2}$/.test(term) || /^\d{1,2}\/\d{1,2}$/.test(term)) return text.split(' ').includes(term);
    return text.includes(term);
  }
  function matches(record, queryTerms) {
    return queryTerms.every(term=>{
      const isDate=/^day\d{1,2}$/.test(term)||/^\d{1,2}\/\d{1,2}$/.test(term);
      return contains(isDate&&record.kind==='day'&&record.meta?record.meta:record.search,term);
    });
  }
  function rank(record, queryTerms) {
    if (!queryTerms.length) return 0;
    let score=record.kind==='day'?1:0;
    for (const term of queryTerms) {
      if(contains(record.title,term))score+=20;
      if(contains(record.meta,term))score+=12;
    }
    return score;
  }
  function search(records, query, kind='all') {
    const queryTerms=terms(query);
    return records.filter(record=>(kind==='all'||record.kind===kind)&&matches(record,queryTerms))
      .map((record,position)=>({record,position,score:rank(record,queryTerms)}))
      .sort((a,b)=>queryTerms.length ? b.score-a.score||a.position-b.position : a.position-b.position)
      .map(item=>item.record);
  }
  function snippet(parts, query, maxLength=90) {
    const queryTerms=terms(query);
    const candidates=parts.filter(part=>part.trim());
    const part=candidates.find(part=>queryTerms.some(term=>normalize(part).includes(term))) || candidates[0] || '';
    return part.length>maxLength?part.slice(0,maxLength).trimEnd()+'…':part;
  }
  function hashId(hash) {
    try { const id=decodeURIComponent(String(hash).replace(/^#/,''));return /^[a-z][a-z\d-]*$/i.test(id)?id:null; }
    catch { return null; }
  }
  function safeResume(value, validIds) {
    return value && typeof value==='object' && typeof value.id==='string' && validIds.has(value.id) ? value.id : null;
  }
  function selectedKind(value) { return ['all','day','food','practical','chapter'].includes(value)?value:'all'; }
  return {MAX_QUERY, fold, boundedQuery, normalize, terms, matches, rank, search, snippet, hashId, safeResume, selectedKind};
});
