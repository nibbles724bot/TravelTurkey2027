const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../guide-core.js');
const record=(id,title,text,kind='day',meta='')=>({id,kind,title:core.normalize(title),search:core.normalize(title+' '+meta+' '+text),meta:core.normalize(meta)});
const records=[record('arrival','台北 → 伊斯坦堡','飛機','day','DAY 01 9/24'),record('balloon','熱氣球與格雷梅','卡帕多奇亞 早晨','day','DAY 07 9/30'),record('food','格雷梅美食','陶罐烤肉','food'),record('sea','Ölüdeniz 藍色潟湖','海岸','day','DAY 14 10/7')];
test('English aliases and Turkish diacritics find the Chinese itinerary',()=>{
 assert.deepEqual(core.search(records,'ＧÖＲＥＭＥ 熱氣球').map(x=>x.id),['balloon']);
 assert.deepEqual(core.search(records,'oludeniz').map(x=>x.id),['sea']);
});
test('Simplified Chinese aliases, spaces and punctuation are accepted',()=>{
 assert.deepEqual(core.search(records,'卡帕多奇亚，热气球').map(x=>x.id),['balloon']);
 assert.deepEqual(core.search(records,'伊斯坦布尔').map(x=>x.id),['arrival']);
});
test('day and date shorthand retain leading-zero equivalence',()=>{
 assert.deepEqual(core.search(records,'day7').map(x=>x.id),['balloon']);
 assert.deepEqual(core.search(records,'09/30').map(x=>x.id),['balloon']);
});
test('all search terms must match; category filters do not leak other kinds',()=>{
 assert.equal(core.search(records,'goreme 海岸').length,0);
 assert.deepEqual(core.search(records,'goreme','food').map(x=>x.id),['food']);
});
test('title matches rank ahead of body-only matches and ties remain stable',()=>{
 const items=[record('body','住宿','格雷梅'),record('title','格雷梅一日','住宿'),record('title2','格雷梅二日','住宿')];
 assert.deepEqual(core.search(items,'格雷梅').map(x=>x.id),['title','title2','body']);
});
test('empty and punctuation-only queries never enter an empty-token loop',()=>{
 assert.deepEqual(core.terms(' ｜， ＋ '),[]);
 assert.equal(core.search(records,'\u0301').length,4);
});
test('query length is bounded without treating data as executable markup',()=>{
 assert.equal(core.boundedQuery('a'.repeat(500)).length,120);
 assert.equal(core.search(records,'<img onerror=alert(1)>').length,0);
});
test('snippets choose relevant paragraphs, cap length and keep original text',()=>{
 assert.equal(core.snippet(['住宿在山上','格雷梅的熱氣球'],'goreme'),'格雷梅的熱氣球');
 assert.equal(core.snippet(['a'.repeat(200)],'a').length,91);
});
test('malformed hashes and storage values cannot break navigation',()=>{
 assert.equal(core.hashId('#%E0%A4%A'),null);
 assert.equal(core.hashId('#slide-7'),'slide-7');
 assert.equal(core.hashId('#<script>'),null);
 assert.equal(core.safeResume({id:'slide-7',title:'stale'},new Set(['slide-7'])),'slide-7');
 assert.equal(core.safeResume('bad',new Set(['slide-7'])),null);
 assert.equal(core.safeResume({id:'slide-999'},new Set(['slide-7'])),null);
});
test('unsupported URL categories fall back to all',()=>assert.equal(core.selectedKind('javascript:alert(1)'),'all'));

test('day and date queries do not accidentally match longer day numbers',()=>{
 const items=[record('one','出發','', 'day','DAY 01 10/1'),record('ten','返程','','day','DAY 10 10/10')];
 assert.deepEqual(core.search(items,'day1').map(x=>x.id),['one']);
 assert.deepEqual(core.search(items,'10/1').map(x=>x.id),['one']);
});

test('day/date lookup selects the itinerary date rather than cross-day notes',()=>{
 const items=[record('seven','熱氣球','', 'day','DAY 07 9/30'),record('eight','綠線','9/30 停飛改 Day07', 'day','DAY 08 10/1')];
 assert.deepEqual(core.search(items,'day7').map(x=>x.id),['seven']);
 assert.deepEqual(core.search(items,'9/30').map(x=>x.id),['seven']);
});
