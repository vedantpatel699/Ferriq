"""Render the reconciled submission manual. Build-only dependency: reportlab.

Usage: python scripts/submission-manual.py <regular.ttf> <bold.ttf>
The selected Unicode fonts are embedded, so readers do not need them installed.
"""
import re
import sys
from html import escape
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, CondPageBreak

for name,path in zip(('Body','Bold'),sys.argv[1:3]):pdfmetrics.registerFont(TTFont(name,path))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
base=Path('submission/sudhakar')
styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=9,leading=13,spaceAfter=6,textColor=colors.HexColor('#32302F')),
 'title':ParagraphStyle('title',fontName='Bold',fontSize=23,leading=29,spaceAfter=14),
 'h2':ParagraphStyle('h2',fontName='Bold',fontSize=18,leading=24,spaceAfter=12,keepWithNext=True),
 'h3':ParagraphStyle('h3',fontName='Bold',fontSize=11,leading=15,spaceBefore=9,spaceAfter=5,keepWithNext=True),
 'cell':ParagraphStyle('cell',fontName='Body',fontSize=8,leading=11,spaceAfter=0),
}
def markup(s):
 s=escape(s).replace('—',' - ')
 subs=str.maketrans('ᵢₐₑₘₙₚₛₜ','iaemnpst')
 s=re.sub('[ᵢₐₑₘₙₚₛₜ]+',lambda m:'<sub>'+m[0].translate(subs)+'</sub>',s)
 s=re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',lambda m:f'<link href="{m[2]}" color="#2F6F9F">{m[1]}</link>',s)
 s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
 return s
def para(s,style='body'):return Paragraph(markup(s),styles[style])
story=[];lines=(base/'engineering-manual.md').read_text(encoding='utf-8').splitlines();i=0
while i<len(lines):
 line=lines[i].strip();i+=1
 if not line:continue
 if line.startswith('## '):
  story.extend([CondPageBreak(400),Spacer(1,14),para(line[3:],'h2')]);continue
 if line.startswith('# '):story.append(para(line[2:],'title'));continue
 if line.startswith('### '):story.append(para(line[4:],'h3'));continue
 if line.startswith('|'):
  raw=[line]
  while i<len(lines) and lines[i].startswith('|'):raw.append(lines[i]);i+=1
  rows=[[para(c.strip(),'cell') for c in r.strip('|').split('|')] for r in raw if not re.match(r'^\|[-| :]+\|$',r)]
  table=Table(rows,colWidths=[152,77,A4[0]-88-229],repeatRows=1,hAlign='LEFT')
  table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EAE8E4')),('LINEBELOW',(0,0),(-1,-1),.3,colors.HexColor('#D9D6D0')),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
  story.extend([table,Spacer(1,7)]);continue
 if line.startswith('- '):line='• '+line[2:]
 story.append(para(line))

def footer(canvas,doc):
 canvas.setFont('Body',8);canvas.setFillColor(colors.HexColor('#615E5C'))
 canvas.drawString(44,25,'FERRIQ  |  Engineering review  |  17 September 2026')
 canvas.drawRightString(A4[0]-44,25,str(doc.page))

SimpleDocTemplate(str(base/'engineering-manual.pdf'),pagesize=A4,leftMargin=44,rightMargin=44,topMargin=40,bottomMargin=43,title='Ferriq engineering manual',author='Ferriq').build(story,onFirstPage=footer,onLaterPages=footer)
print(base/'engineering-manual.pdf')
