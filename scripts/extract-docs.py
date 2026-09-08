from html.parser import HTMLParser
from pathlib import Path
import json
class Docs(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root={'tag':'div','children':[]};self.stack=[self.root]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs); n={'tag':tag,'children':[]}
  if 'id' in a:n['id']=a['id']
  if tag=='a' and a.get('href','').startswith('https://'):n['href']=a['href']
  self.stack[-1]['children'].append(n)
  if tag not in ['br','hr','img','input','meta','link','wbr']:self.stack.append(n)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i]['tag']==tag:self.stack=self.stack[:i];break
 def handle_data(self,text):
  if text.strip():self.stack[-1]['children'].append(text)
def find(n,ids):
 if isinstance(n,str):return []
 if n.get('id') in ids:return [n]
 return sum([find(c,ids) for c in n['children']],[])
def clean(n):
 if isinstance(n,str):return n
 if n['tag'] in ['script','style','button','input','select','option','svg']:return None
 children=[v for c in n['children'] if (v:=clean(c)) is not None]
 tag=n['tag'] if n['tag'] in ['p','h2','h3','h4','h5','strong','em','ul','ol','li','table','thead','tbody','tr','th','td','sub','sup','code','pre','a','br','hr'] else 'div'
 return {'tag':tag,'children':children,**({'href':n['href']} if 'href'in n else {})}
out={}
for p in Path('reference/original').glob('*.html'):
 d=Docs();d.feed(p.read_text(encoding='utf-8'))
 out[p.stem]=[clean(n) for n in find(d.root,{'panel-about','panel-sources','manualPanel'})]
 if p.stem=='furnace-skin-temp':
  m=Docs();m.feed(Path('reference/furnace-manual.html').read_text(encoding='utf-8'));out[p.stem].append(clean(m.root))
Path('src/reference/manuals.json').write_text(json.dumps(out,ensure_ascii=False),encoding='utf-8')
