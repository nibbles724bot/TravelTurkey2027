"""Build the offline-friendly travel guide from the preserved slide content."""
from pathlib import Path
import json
import re
import hashlib
from urllib.parse import quote, urlparse, parse_qs
from html import escape as e

ROOT = Path(__file__).resolve().parent.parent
slides = json.loads((ROOT / 'slides.json').read_text())
days = [s for s in slides if s['paragraphs'] and s['paragraphs'][0].startswith('DAY')]
FOOD_PAGES={9,13,18,22,29,35}
KIND_LABELS={'day':'每日行程','food':'美食','practical':'交通與準備','chapter':'旅程與城市'}
def page_kind(n):
    return 'day' if any(d['number']==n for d in days) else 'food' if n in FOOD_PAGES else 'practical' if n>=38 else 'chapter'

def filters(prefix):
    return '<div class="filter-tabs" role="group" aria-label="內容類型">'+''.join(f'<button type="button" data-{prefix}-kind="{kind}" aria-pressed="{str(kind=="all").lower()}">{label}</button>' for kind,label in [('all','全部'),('day','行程'),('food','美食'),('practical','交通準備')])+'</div>'

day_targets = {int(re.search(r'DAY (\d+)', s['paragraphs'][0])[1]): s['number'] for s in days}

def p(text):
    return f'<p>{e(text)}</p>'

def link(label, url, cls=''):
    return f'<a class="{cls}" href="{e(url, quote=True)}" target="_blank" rel="noopener noreferrer">{e(label)}<span class="sr-only">（另開分頁）</span></a>'

def maps(query, label='Google Maps', context=''):
    """Link to a named-place search, without claiming a verified address."""
    url='https://www.google.com/maps/search/?api=1&query='+quote(query)
    return f'<a class="map-link" href="{e(url,quote=True)}" target="_blank" rel="noopener noreferrer">{e(label)}<span class="sr-only">：{e(context or query)}（另開分頁）</span></a>'

STAY_AREAS={6:'Sultanahmet Istanbul',7:'Sultanahmet Istanbul',8:'Sultanahmet Istanbul',11:'Safranbolu old town',12:'Safranbolu',14:'Goreme',16:'Goreme',17:'Goreme',19:'Kahta',21:'Kahta',24:'Kaleici Antalya',26:'Kas Antalya',27:'Kas Antalya',28:'Oludeniz Fethiye',31:'Pamukkale village',32:'Selcuk',34:'Karakoy Galata Istanbul'}
CITY_QUERIES={'伊斯坦堡':'Istanbul','番紅花城':'Safranbolu','安卡拉':'Ankara','格雷梅':'Goreme','Kayseri':'Kayseri','Kahta':'Kahta','Adıyaman':'Adiyaman','安塔利亞':'Antalya','卡什':'Kas Antalya','費特希耶':'Fethiye','Ölüdeniz':'Oludeniz','代尼茲利':'Denizli','棉堡':'Pamukkale','塞爾丘克':'Selcuk','伊茲密爾機場':'Izmir Adnan Menderes Airport','伊茲密爾':'Izmir','希林傑':'Sirince'}

def place_query(text):
    for name in sorted(CITY_QUERIES,key=len,reverse=True):
        if name in text:return CITY_QUERIES[name]+' Turkey'
    return text+' Turkey'

def references(s):
    if not s['links']: return ''
    return '<details class="references"><summary>照片與參考連結</summary><ul>'+''.join('<li>'+link(l['text'],l['url'])+'</li>' for l in s['links'])+'</ul></details>'

def day_content(s):
    items=s['paragraphs']; scenic=items.index('景點介紹'); stay=items.index('今晚住宿')
    region_end=stay-(1 if items[stay-1]=='示意插圖' else 0)
    region=items[region_end-1]
    summary=items[2]
    mode,duration=re.match(r'交通\s*(.*?)\s*｜\s*預估\s*(.*)',summary).groups()
    body=f'<section class="travel-info" id="transport-{s["number"]}" tabindex="-1" aria-label="交通與時間"><h3>交通與時間</h3><dl class="transport-summary"><div><dt>交通方式</dt><dd>{e(mode)}</dd></div><div><dt>預估時間</dt><dd>{e(duration)}</dd></div></dl><ul class="travel-notes">'
    for note in items[3:scenic]:body+=f'<li>{e(note)}</li>'
    body+='</ul></section>'
    body+='<section class="sights"><h3>這一天的行程</h3>'
    sights=items[scenic+1:region_end-1]
    for i in range(0,len(sights),2):
        body+=f'<section class="sight"><h4>{e(sights[i])}</h4>'
        if not sights[i].startswith('關於'):
            source=next((l for l in s['links'] if l['text']==sights[i]),None)
            query=parse_qs(urlparse(source['url']).query).get('q',[sights[i]+' '+region])[0] if source else sights[i]+' '+region
            body+=maps(query+' Turkey','Google Maps',sights[i])
        if i+1<len(sights):body+=p(sights[i+1])
        body+='</section>'
    body+=f'</section><div class="stay"><h3>今晚住宿</h3>{p(items[stay+1])}'+(maps(STAY_AREAS[s['number']]+' Turkey','住宿區域 Google Maps',items[stay+1]) if s['number'] in STAY_AREAS else '')+'</div>'
    return region,body+references(s)

def rows(data, width):
    assert len(data)%width == 0, (len(data),width)
    return [data[i:i+width] for i in range(0,len(data),width)]

def content(s):
    n=s['number']; a=s['paragraphs']
    if n==2:
        stops=[('伊斯坦堡','DAY 01–03 · 18–19',6,240,111),('番紅花城','DAY 04–05',11,648,119),('安卡拉','DAY 06 · 途經',14,687,235),('卡帕多奇亞','DAY 06–09',14,805,342),('Kahta','DAY 09–10',21,903,457),('安塔利亞','DAY 11',24,454,593),('卡什','DAY 12–13',26,212,593),('死海 Ölüdeniz','DAY 14',28,97,510),('棉堡','DAY 15',31,138,414),('塞爾丘克','DAY 16–17',32,139,316)]
        pins=''.join(f'<a class="route-pin" href="#slide-{target}" style="left:{x/1217*100:.2f}%;top:{y/702*100:.2f}%" aria-label="{e(city)}，{e(day)}，閱讀行程"><span>{e(city)}</span></a>' for city,day,target,x,y in stops)
        cities=''.join(f'<li><a href="#slide-{target}"><span class="route-stop-number">{i:02d}</span><span><strong>{e(city)}</strong><small>{e(day)}</small></span><span aria-hidden="true">↗</span></a></li>' for i,(city,day,target,x,y) in enumerate(stops,1))
        illustration='<figure class="illustrated-route"><div class="route-map-visual"><a class="route-map-image" href="assets/turkey-route-map.webp" target="_blank" rel="noopener noreferrer" aria-label="開啟完整土耳其路線大圖"><img src="assets/turkey-route-map.webp" width="1217" height="702" loading="lazy" decoding="async" alt="土耳其十九日環線插畫：由伊斯坦堡出發，經番紅花城、安卡拉、卡帕多奇亞、Kahta，沿地中海與愛琴海返回；藍色海域與米白陸地上以紅色箭頭串連城市。"></a><nav class="route-map-pins" aria-label="地圖城市行程">'+pins+'</nav></div><figcaption><span>沿著紅色路線，走一圈土耳其</span><a href="assets/turkey-route-map.webp" target="_blank" rel="noopener noreferrer">開啟大圖 ↗</a></figcaption></figure><nav aria-label="沿途城市行程"><ol class="route-stops">'+cities+'</ol></nav>'
        body=illustration+p(a[1])+'<div class="stats"><span><strong>18</strong>晚住宿</span><span><strong>11</strong>段交通</span><span><strong>3</strong>次熱氣球機會</span></div><ol class="route-list">'
        for number,route,time in rows(a[11:],3):body+=f'<li><div>{e(route)}</div><span>{e(time)}</span></li>'
        return body+'</ol><div class="city-maps"><h3>沿途城市 Google Maps</h3>'+''.join(maps(place_query(city),city) for city in ['伊斯坦堡','番紅花城','安卡拉','格雷梅','Kahta','安塔利亞','卡什','費特希耶','Ölüdeniz','棉堡','塞爾丘克','希林傑'])+'</div>'
    if n==4:
        data=[t for t in a[1:] if t not in ['Day','日期','行程','住宿']]
        body='<ol class="overview">'
        for day,date,title,stay in rows(data,4):
            body+=f'<li><a href="#slide-{day_targets[int(day)]}"><span class="overview-date">DAY {int(day):02d} · {e(date)}</span><strong>{e(title)}</strong><span class="overview-stay">住宿 · {e(stay)}</span><span class="read-day">閱讀當日行程</span></a></li>'
        return body+'</ol>'
    if n in FOOD_PAGES:
        body='<div class="food-list">'
        for title,description,place in rows(a[3:-1],3):
            body+=f'<section><h3>{e(title)}</h3>{p(description)}'+(f'<p class="place">地點 · {e(place)}</p>' if place!='—' else '')
            if title not in ['必吃美食','必吃甜點','小提醒','旅館餐廳']:
                city={9:'Istanbul',13:'Safranbolu',18:'Uchisar Cappadocia' if '烏奇沙' in place else 'Goreme Cappadocia',22:'Kahta',29:'Antalya' if '安塔利亞' in place else 'Kas Antalya',35:place_query(place)}[n]
                body+=maps(title+' '+city+('' if 'Turkey' in city else ' Turkey'),'餐廳 Google Maps',title)
            body+='</section>'
        return body+'</div>'
    if n==38:
        body='<p class="note">原稿班次以 2026 年資料為主。</p><div class="transport-list">'
        for number,route,mode,time,schedule in rows(a[6:-1],5):
            body+=f'<section><h3>{e(route)}</h3><p class="transport-meta">{e(mode)} · {e(time)}</p>{p(schedule)}'
            points=route.split(' → ')
            body+='<div class="transport-maps">'+maps(place_query(points[0]),'出發地 Google Maps',points[0])+maps(place_query(points[-1]),'目的地 Google Maps',points[-1])+'</div></section>'
        return body+'</div>'+p(a[-1])
    if n==39:
        body='<div class="prep-list">'
        for number,title,text in rows(a[1:],3):body+=f'<section class="prep-item"><label><input class="prep-check" type="checkbox" data-key="prep-{number}"><span>{e(title)}</span></label>{p(text)}</section>'
        body+='<p id="prep-progress" role="status">已完成 0 / 4 項</p><button id="reset-prep" class="js-only">重設準備清單</button>'
        return body+'</div>'
    if n==40:
        return '<ul class="source-list">'+''.join('<li>'+link(l['text'],l['url'])+'</li>' for l in s['links'])+'</ul>'+p('每日行程下方的「照片與參考連結」可查看實景搜尋，原始簡報請由右上角連結開啟。')
    return ''.join(p(t) for t in a)

sections=[]
for s in slides:
    n=s['number']; a=s['paragraphs']; is_day=s in days; cover=not a
    search=' '.join([s['title']]+a)
    attrs=f'id="slide-{n}" class="slide {"day" if is_day else "chapter" if cover else "reference-page"}" aria-labelledby="title-{n}" tabindex="-1" data-kind="{page_kind(n)}" data-kind-label="{KIND_LABELS[page_kind(n)]}" data-search="{e(search,quote=True)}"'
    if n==1:
        sections.append(f'<article {attrs}><div class="hero-art"><img src="assets/rabbit-trip.svg" alt="穿著橘色衣服的小白兔帶著藍色行李箱，準備熱氣球旅行" width="900" height="600" fetchpriority="high"></div><div class="hero-copy"><p class="eyebrow">2027.09.24 — 10.12</p><h1 id="title-1">土耳其環線<br>19 天的小旅行</h1><p>從伊斯坦堡的老街，到卡帕多奇亞的天空，沿著地中海，一路走回愛琴海。</p><a class="primary" href="#slide-4">查看 19 天行程</a><a class="secondary" href="#slide-6">從第一天開始</a></div></article>')
        continue
    if is_day:
        region,body=day_content(s); title='台北 → 伊斯坦堡' if n==6 else a[1]
        head=f'<p class="day-label">{e(a[0])}<span>{e(region)}</span></p><h2 id="title-{n}">{e(title)}</h2>'
    elif cover:
        head=f'<p class="eyebrow">旅途風景</p><h2 id="title-{n}">{e(s["title"])}</h2>'
        body='<p class="chapter-summary">2027/9/24–10/12 · 19 天、18 晚，順時針環遊土耳其。</p>' if n==3 else ''
    else:
        head=f'<p class="eyebrow">旅行手帖</p><h2 id="title-{n}">{e(s["title"])}</h2>'; body=content(s)
    tools=''
    if is_day:
        index=days.index(s)
        food=9 if n<=8 else 13 if n<=14 else 18 if n<=19 else 22 if n<=21 else 29 if n<=28 else 35 if n<=34 else 9
        tools=f'<nav class="day-shortcuts" aria-label="當日快速導覽"><a href="#transport-{n}">交通資訊</a><a href="#slide-{food}">當地美食</a><a href="#slide-4">行程總覽</a></nav>'
        previous=f'<a rel="prev" href="#slide-{days[index-1]["number"]}">前一天 · DAY {index:02d}</a>' if index else '<a href="#slide-4">行程總覽</a>'
        following=f'<a rel="next" href="#slide-{days[index+1]["number"]}">下一天 · DAY {index+2:02d}</a>' if index<len(days)-1 else '<a href="#slide-39">行前準備</a>'
        body+=f'<nav class="day-pagination" aria-label="第 {index+1} 天前後行程">{previous}{following}</nav>'
    sections.append(f'<article {attrs}><div class="slide-heading">{head}</div>{tools}{body}</article>')

nav=[(1,'旅程封面'),(4,'19 天行程總覽'),(5,'伊斯坦堡'),(10,'番紅花城'),(15,'卡帕多奇亞'),(20,'內姆魯特山'),(23,'地中海海岸'),(30,'棉堡與以弗所'),(36,'回到伊斯坦堡'),(38,'交通總表'),(39,'行前準備'),(40,'資料來源')]
menu='<div class="menu-group"><div class="menu-overview">'+''.join(f'<a data-menu-item data-kind="chapter" href="#slide-{n}">{e(label)}</a>' for n,label in [(1,'旅程首頁'),(2,'路線地圖'),(4,'19 天總覽')])+'</div></div><section class="menu-group"><h3 id="menu-days">每日行程</h3><ol class="menu-days">'
for day in days:
    number=int(re.search(r'DAY (\d+)',day['paragraphs'][0])[1])
    date=re.sub(r'^DAY \d+\s*','',day['paragraphs'][0])
    title='台北 → 伊斯坦堡' if day['number']==6 else day['paragraphs'][1]
    menu+=f'<li><a data-menu-item data-kind="day" href="#slide-{day["number"]}"><span class="menu-day-number">{number:02d}</span><span><small>{e(date)}</small><strong>{e(title)}</strong></span></a></li>'
menu+='</ol></section><section class="menu-group"><h3>城市・美食・實用資料</h3><div class="menu-places">'+''.join(f'<a data-menu-item data-kind="{page_kind(x["number"])}" href="#slide-{x["number"]}">{e(x["title"])}</a>' for x in slides[4:] if x not in days)+'</div></section>'
# All 40 pages, including the image-only overview, remain reachable.
menu+='<a data-menu-item data-kind="chapter" class="menu-extra" href="#slide-3">旅程總覽</a>'
html='''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#fffdf8"><meta name="description" content="2027 土耳其 19 天自由行，手機也能輕鬆閱讀的每日行程、交通、住宿與美食手帖。"><meta property="og:title" content="土耳其環線 · 2027 旅行手帖"><meta property="og:description" content="19 天自由行：每日交通、景點、住宿與美食"><meta property="og:type" content="website"><link rel="canonical" href="https://nibbles724bot.github.io/TravelTurkey2027/"><meta name="color-scheme" content="light"><meta name="format-detection" content="telephone=no"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><title>土耳其環線 · 2027 旅行手帖</title><link rel="stylesheet" href="style.css"><script>document.documentElement.classList.add("js")</script><script src="guide-core.js" defer onerror="document.documentElement.classList.remove('js')"></script><script src="app.js" defer onerror="document.documentElement.classList.remove('js')"></script></head><body><a class="skip" href="#journey">跳至行程</a><div class="reading-progress" aria-hidden="true"><span id="reading-progress"></span></div><header><a class="brand" href="#slide-1">TÜRKİYE <span>2027 · 土耳其旅行</span></a><a class="source" href="https://docs.google.com/presentation/d/1R3rRgthyyVZKir0g0Ztm9C8AtsBktX26/edit" target="_blank" rel="noopener noreferrer">原始簡報<span class="sr-only">（另開分頁）</span></a></header><div class="mobile-toolbar js-only"><button id="jump-toggle" type="button" aria-expanded="false" aria-haspopup="dialog" aria-controls="trip-menu"><span class="jump-copy"><span id="jump-label">選擇行程</span><strong id="jump-subtitle">19 天土耳其旅行</strong></span><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg></button><button id="search-toggle" aria-expanded="false" aria-controls="guide-nav"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m15 15 5 5" stroke="currentColor" stroke-width="1.7"/></svg><span>搜尋</span></button></div><dialog id="trip-menu" aria-labelledby="menu-title" aria-describedby="menu-help"><div class="menu-header"><div><p class="eyebrow">TÜRKİYE · 2027</p><h2 id="menu-title">今天想看哪一天？</h2><p id="menu-help" class="sr-only">可搜尋日期、城市或美食。按 Escape 關閉，選擇行程後會直接跳轉。</p></div><button id="close-menu" aria-label="關閉行程目錄">關閉</button></div><div class="menu-controls"><label class="sr-only" for="menu-search">搜尋行程目錄</label><div class="search-row"><input id="menu-search" type="search" maxlength="120" placeholder="找日期、城市或美食" autocomplete="off" enterkeyhint="search"><button id="menu-clear" type="button" aria-label="清除目錄搜尋">清除</button></div>'''+filters("menu")+'''<p id="menu-count" role="status" aria-live="polite">40 個章節</p></div><div class="menu-body">'''+menu+'''<div id="menu-empty" hidden><p>沒有符合的章節</p><button id="menu-reset" type="button">顯示全部章節</button></div></div></dialog><div class="layout"><aside id="guide-nav" aria-label="行程導覽"><div class="sidebar-title"><p class="eyebrow">2027 · 旅行手帖</p><p class="sidebar-heading">19 天，<br>繞一圈土耳其。</p></div><div class="search-tools js-only"><button id="desktop-menu" type="button" aria-haspopup="dialog" aria-controls="trip-menu" aria-expanded="false">行程目錄</button><button id="font-toggle" aria-pressed="false">放大文字</button></div><div class="search-ui js-only"><label for="search">搜尋城市、景點或交通</label><div class="search-row"><input id="search" type="search" maxlength="120" placeholder="例如：格雷梅、獨木舟" autocomplete="off" enterkeyhint="search" aria-describedby="result"><button id="clear-search" aria-label="清除搜尋">清除</button></div>'''+filters('search')+'''<div id="search-suggestions" class="suggestions" aria-label="常用搜尋"><button type="button" data-query="熱氣球">熱氣球</button><button type="button" data-query="機場">機場</button><button type="button" data-query="棉堡">棉堡</button></div><p id="result" role="status" aria-live="polite" aria-atomic="true">19 天行程・美食・交通準備</p><ol id="search-results" aria-label="搜尋結果" tabindex="-1" hidden></ol></div><nav aria-label="章節">'''+''.join(f'<a href="#slide-{n}">{e(t)}</a>' for n,t in nav)+'''</nav></aside><div id="search-backdrop" hidden></div><main id="journey" tabindex="-1"><div id="resume" class="resume" hidden><p id="resume-label"></p><a id="resume-link" href="#slide-1">繼續閱讀</a><button id="dismiss-resume" aria-label="關閉繼續閱讀提示">關閉</button></div>'''+''.join(sections)+'''<div id="empty" hidden><h2>找不到符合的行程</h2><p>試試城市、景點或交通方式，或清除搜尋看完整旅程。</p><button id="reset-search">顯示全部行程</button></div><footer>依原始 Google Slides 完整轉製 · 40 頁<br>班次、票價與入境資訊保留原稿內容及資料年份，請由參考連結確認出發時資訊。<a href="#slide-1">回到旅程開頭</a></footer></main></div><div id="notice" class="notice" role="status" aria-live="polite"></div><button id="back-top" class="js-only" hidden aria-label="回到頁首">頂端</button><noscript><p class="noscript-note">可直接閱讀全部行程；使用瀏覽器「在頁面中尋找」搜尋內容。</p></noscript></body></html>'''
for asset in ['style.css', 'guide-core.js', 'app.js', 'assets/favicon.svg', 'assets/rabbit-trip.svg', 'assets/turkey-route-map.webp']:
    version=hashlib.sha256((ROOT/asset).read_bytes()).hexdigest()[:10]
    html=html.replace(f'"{asset}"', f'"{asset}?v={version}"')
html=re.sub(r'<button(?![^>]*\btype=)', '<button type="button"', html)
(ROOT/'index.html').write_text(html.replace('><', '>\n<')+'\n')
print(f'Built {len(slides)} pages and {len(days)} readable day itineraries.')
