"""Build the offline-friendly travel guide from the preserved slide content."""
from pathlib import Path
import json
import re
import hashlib
from html import escape as e

ROOT = Path(__file__).resolve().parent.parent
slides = json.loads((ROOT / 'slides.json').read_text())
days = [s for s in slides if s['paragraphs'] and s['paragraphs'][0].startswith('DAY')]
day_targets = {int(re.search(r'DAY (\d+)', s['paragraphs'][0])[1]): s['number'] for s in days}

def p(text):
    return f'<p>{e(text)}</p>'

def link(label, url, cls=''):
    return f'<a class="{cls}" href="{e(url, quote=True)}" target="_blank" rel="noopener noreferrer">{e(label)}</a>'

def original(s):
    n = s['number']
    return f'<details class="original"><summary>查看原始簡報 · 第 {n} 頁</summary><a class="artwork" href="assets/slides/{n:02d}.webp" target="_blank" aria-label="開啟第 {n} 頁完整大圖"><img src="assets/slides/{n:02d}.webp" width="2000" height="1125" alt="{e(s["title"], quote=True)}" loading="lazy" decoding="async"></a><p class="image-hint">點選圖片可開啟大圖，並用雙指放大。</p></details>'

def references(s):
    if not s['links']: return ''
    return '<details class="references"><summary>照片與參考連結</summary><ul>'+''.join('<li>'+link(l['text'],l['url'])+'</li>' for l in s['links'])+'</ul></details>'

def day_content(s):
    items=s['paragraphs']; scenic=items.index('景點介紹'); stay=items.index('今晚住宿')
    region_end=stay-(1 if items[stay-1]=='示意插圖' else 0)
    region=items[region_end-1]
    body=f'<div class="travel-info"><h3>交通與時間</h3>{"".join(p(t) for t in items[2:scenic])}</div>'
    body+='<section class="sights"><h3>這一天的行程</h3>'
    sights=items[scenic+1:region_end-1]
    for i in range(0,len(sights),2):
        body+=f'<section class="sight"><h4>{e(sights[i])}</h4>'
        if i+1<len(sights):body+=p(sights[i+1])
        body+='</section>'
    body+=f'</section><div class="stay"><h3>今晚住宿</h3>{p(items[stay+1])}</div>'
    return region,body+references(s)

def rows(data, width):
    assert len(data)%width == 0, (len(data),width)
    return [data[i:i+width] for i in range(0,len(data),width)]

def content(s):
    n=s['number']; a=s['paragraphs']
    if n==2:
        body=p(a[1])+'<div class="stats"><span><strong>18</strong>晚住宿</span><span><strong>11</strong>段交通</span><span><strong>3</strong>次熱氣球機會</span></div><ol class="route-list">'
        for number,route,time in rows(a[11:],3):body+=f'<li><div>{e(route)}</div><span>{e(time)}</span></li>'
        return body+'</ol>'
    if n==4:
        data=[t for t in a[1:] if t not in ['Day','日期','行程','住宿']]
        body='<ol class="overview">'
        for day,date,title,stay in rows(data,4):
            body+=f'<li><a href="#slide-{day_targets[int(day)]}"><span class="overview-date">DAY {int(day):02d} · {e(date)}</span><strong>{e(title)}</strong><span class="overview-stay">住宿 · {e(stay)}</span><span class="read-day">閱讀當日行程</span></a></li>'
        return body+'</ol>'
    if n in [9,13,18,22,29,35]:
        body='<div class="food-list">'
        for title,description,place in rows(a[3:-1],3):
            body+=f'<section><h3>{e(title)}</h3>{p(description)}'+(f'<p class="place">地點 · {e(place)}</p>' if place!='—' else '')+'</section>'
        return body+'</div>'
    if n==38:
        body='<p class="note">原稿班次以 2026 年資料為主。</p><div class="transport-list">'
        for number,route,mode,time,schedule in rows(a[6:-1],5):
            body+=f'<section><h3>{e(route)}</h3><p class="transport-meta">{e(mode)} · {e(time)}</p>{p(schedule)}</section>'
        return body+'</div>'+p(a[-1])
    if n==39:
        body='<div class="prep-list">'
        for number,title,text in rows(a[1:],3):body+=f'<section><h3>{e(title)}</h3>{p(text)}</section>'
        return body+'</div>'
    if n==40:
        return '<ul class="source-list">'+''.join('<li>'+link(l['text'],l['url'])+'</li>' for l in s['links'])+'</ul>'+p(a[-1])
    return ''.join(p(t) for t in a)

sections=[]
for s in slides:
    n=s['number']; a=s['paragraphs']; is_day=s in days; cover=not a
    search=' '.join([s['title']]+a)
    attrs=f'id="slide-{n}" class="slide {"day" if is_day else "chapter" if cover else "reference-page"}" aria-labelledby="title-{n}" data-search="{e(search,quote=True)}"'
    if n==1:
        sections.append(f'<article {attrs}><div class="hero-art"><img src="assets/slides/01.webp" alt="土耳其熱氣球與卡帕多奇亞岩石插畫" width="2000" height="1125" fetchpriority="high"></div><div class="hero-copy"><p class="eyebrow">2027.09.24 — 10.12</p><h1 id="title-1">土耳其環線<br>19 天的小旅行</h1><p>從伊斯坦堡的老街，到卡帕多奇亞的天空，沿著地中海，一路走回愛琴海。</p><a class="primary" href="#slide-4">查看 19 天行程</a><a class="secondary" href="#slide-6">從第一天開始</a></div></article>')
        continue
    if is_day:
        region,body=day_content(s); title='台北 → 伊斯坦堡' if n==6 else a[1]
        head=f'<p class="day-label">{e(a[0])}<span>{e(region)}</span></p><h2 id="title-{n}">{e(title)}</h2>'
    elif cover:
        head=f'<p class="eyebrow">旅途風景</p><h2 id="title-{n}">{e(s["title"])}</h2>'
        body=f'<a class="chapter-art" href="assets/slides/{n:02d}.webp" target="_blank" aria-label="放大{s["title"]}原稿"><img src="assets/slides/{n:02d}.webp" width="2000" height="1125" alt="{e(s["title"],quote=True)}原始插圖" loading="lazy"></a>'
    else:
        head=f'<p class="eyebrow">旅行手帖</p><h2 id="title-{n}">{e(s["title"])}</h2>'; body=content(s)
    sections.append(f'<article {attrs}><div class="slide-heading">{head}<a class="permalink" href="#slide-{n}" aria-label="第 {n} 頁連結">原稿 {n:02d} / 40</a></div>{body}{"" if cover else original(s)}</article>')

nav=[(1,'旅程封面'),(4,'19 天行程總覽'),(5,'伊斯坦堡'),(10,'番紅花城'),(15,'卡帕多奇亞'),(20,'內姆魯特山'),(23,'地中海海岸'),(30,'棉堡與以弗所'),(36,'回到伊斯坦堡'),(38,'交通總表'),(39,'行前準備'),(40,'資料來源')]
options=''.join(f'<option value="slide-{n}">{e(title)}</option>' for n,title in nav[:2])
for s in days: options+=f'<option value="slide-{s["number"]}">{e(s["paragraphs"][0])} · {e("台北 → 伊斯坦堡" if s["number"]==6 else s["paragraphs"][1])}</option>'
options+=''.join(f'<option value="slide-{n}">{e(t)}</option>' for n,t in nav[-3:])
html='''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f7f5ef"><meta name="description" content="2027 土耳其 19 天自由行，手機也能輕鬆閱讀的每日行程、交通、住宿與美食手帖。"><title>土耳其環線 · 2027 旅行手帖</title><link rel="stylesheet" href="style.css"><script src="app.js" defer></script></head><body><a class="skip" href="#journey">跳至行程</a><header><a class="brand" href="#slide-1">TÜRKİYE <span>2027 旅行手帖</span></a><a class="source" href="https://docs.google.com/presentation/d/1R3rRgthyyVZKir0g0Ztm9C8AtsBktX26/edit" target="_blank" rel="noopener noreferrer">原始簡報</a></header><div class="mobile-toolbar"><label class="sr-only" for="jump">跳至日期或章節</label><select id="jump">'''+options+'''</select><button id="search-toggle" aria-expanded="false" aria-controls="guide-nav">搜尋</button></div><div class="layout"><aside id="guide-nav" aria-label="行程導覽"><div class="sidebar-title"><p class="eyebrow">2027 · 旅行手帖</p><p class="sidebar-heading">19 天，繞一圈土耳其。</p></div><label for="search">搜尋城市、景點或交通</label><div class="search-row"><input id="search" type="search" placeholder="例如：格雷梅、獨木舟" autocomplete="off"><button id="clear-search" aria-label="清除搜尋">清除</button></div><p id="result" role="status" aria-live="polite">完整收錄 19 天 · 40 頁原稿</p><nav aria-label="章節">'''+''.join(f'<a href="#slide-{n}">{e(t)}</a>' for n,t in nav)+'''</nav><p class="hint">行程可直接閱讀。<br>各頁下方可展開原始簡報。</p></aside><main id="journey">'''+''.join(sections)+'''<div id="empty" hidden><h2>找不到符合的行程</h2><p>試試城市、景點或交通方式，或清除搜尋看完整旅程。</p><button id="reset-search">顯示全部行程</button></div><footer>依原始 Google Slides 完整轉製 · 40 頁<br>班次、票價與入境資訊保留原稿內容及資料年份，請由參考連結確認出發時資訊。<a href="#slide-1">回到旅程開頭</a></footer></main></div></body></html>'''
for asset in ['style.css', 'app.js']:
    version=hashlib.sha256((ROOT/asset).read_bytes()).hexdigest()[:10]
    html=html.replace(f'"{asset}"', f'"{asset}?v={version}"')
(ROOT/'index.html').write_text(html.replace('><', '>\n<')+'\n')
print(f'Built {len(slides)} pages and {len(days)} readable day itineraries.')
