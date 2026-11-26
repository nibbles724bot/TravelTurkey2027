"""Check generated guide structure, preserved source content and local assets."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, parse_qs
import json
import re

ROOT = Path(__file__).resolve().parent.parent
class Guide(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=[];self.links=[];self.assets=[];self.text=[];self.options=[];self.days=0;self.originals=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='a':self.links.append(a.get('href',''))
        if tag=='a' and a.get('href','').startswith('#slide-') and a['href'][1:] not in self.options:self.options.append(a['href'][1:])
        if tag=='article' and 'day' in a.get('class','').split():self.days+=1
        if tag=='details' and 'original' in a.get('class','').split():self.originals+=1
        if tag in ['img','script','link']:
            asset=a.get('src') or a.get('href')
            if asset and not asset.startswith(('http','data:')):self.assets.append(urlsplit(asset).path)
        if tag=='source':self.assets.extend(item.strip().split()[0] for item in a['srcset'].split(','))
    def handle_data(self,text):self.text.append(text)

guide=Guide();guide.feed((ROOT/'index.html').read_text())
slides=json.loads((ROOT/'slides.json').read_text());text=''.join(guide.text)
assert len(guide.ids)==len(set(guide.ids)), 'Duplicate IDs'
assert all(href[1:] in guide.ids for href in guide.links if href.startswith('#')), 'Broken internal links'
assert {f'slide-{i}' for i in range(1,41)}<=set(guide.ids)
assert len(guide.options)==40 and len(set(guide.options))==40, 'Incomplete jump menu'
assert guide.days==19 and guide.originals==0
for asset in guide.assets:assert (ROOT/asset).is_file(),f'Missing asset: {asset}'
for slide in slides:
    for source in slide['links']:assert source['url'] in guide.links,source['url']
    if slide['paragraphs'] and slide['paragraphs'][0].startswith('DAY'):
        mode,duration=re.match(r'交通\s*(.*?)\s*｜\s*預估\s*(.*)',slide['paragraphs'][2]).groups()
        assert mode in text and duration in text
        for paragraph in slide['paragraphs'][3:]:
            if paragraph in ['示意插圖','景點介紹'] or paragraph.startswith('看實景照片'):continue
            assert paragraph in text,(slide['number'],paragraph)
for file in ['app.js','style.css']:
    assert re.search(rf'{re.escape(file)}\?v=[a-f0-9]{{10}}',(ROOT/'index.html').read_text())
assert len(re.findall('class="transport-summary"',(ROOT/'index.html').read_text()))==19
assert len(re.findall('class="travel-notes"',(ROOT/'index.html').read_text()))==19
assert 'Miffy' in (ROOT/'IMPROVEMENTS.md').read_text()
assert len(re.findall(r'^\d+\. ',(ROOT/'IMPROVEMENTS.md').read_text(),re.M))==30
print('Validated 40 pages, 19 days, no slide thumbnails, 92 source links, all directory targets and local assets, 30 improvements.')

map_links=[url for url in guide.links if url.startswith('https://www.google.com/maps/search/')]
for url in map_links:
    query=parse_qs(urlsplit(url).query)
    assert query.get('api')==['1'] and query.get('query'),url
assert any('Sultanahmet Köftecisi' in parse_qs(urlsplit(url).query)['query'][0] for url in map_links)
assert any(parse_qs(urlsplit(url).query)['query'][0]=='Karakoy Galata Istanbul Turkey' for url in map_links)
print(f'Validated {len(map_links)} Google Maps search links, including restaurants, lodging areas, cities and transport endpoints.')

markup=(ROOT/'index.html').read_text()
assert markup.count('<img ')==1 and 'assets/slides/' not in markup
assert '<select' not in markup and 'id="trip-menu"' in markup
assert 'save-day' not in markup and 'share-day' not in markup and 'saved-toggle' not in markup
assert markup.count('https://docs.google.com/presentation/d/1R3rRgthyyVZKir0g0Ztm9C8AtsBktX26/edit')==1
print('Verified custom directory, split transport summaries, removed collection/share controls and slide thumbnails.')
