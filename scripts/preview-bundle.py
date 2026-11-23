"""Packt den Vorschau-Build (dist-preview) in eine einzige HTML-Datei für die Handy-Vorschau."""
import base64, pathlib, re, sys
d = pathlib.Path('dist-preview')
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'preview/index.html')
html = (d / 'index.html').read_text()
js = (d / re.search(r'src="\./(assets/[^"]+\.js)"', html).group(1)).read_text()
css = (d / re.search(r'href="\./(assets/[^"]+\.css)"', html).group(1)).read_text()
# woff-Fallbacks entfernen, woff2 als data-URI einbetten
css = re.sub(r',\s*url\([^)]*\.woff\)\s*format\("woff"\)', '', css)
def inline(m):
    data = base64.b64encode((d / 'assets' / m.group(1)).read_bytes()).decode()
    return f'url(data:font/woff2;base64,{data})'
css = re.sub(r'url\(\./([^)]+\.woff2)\)', inline, css)
js = js.replace('</script', '<\\/script')
page = f'''<title>KK Home</title>
<style>{css}</style>
<div id="root"></div>
<script type="module">{js}</script>
'''
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page)
print(out, len(page) // 1024, 'KB')
