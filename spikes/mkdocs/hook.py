import html
import json
import posixpath
from pathlib import Path


_MANIFEST = json.loads(Path(__file__).with_name("projection.json").read_text(encoding="utf-8"))
_DOCUMENTS = {row["id"]: row for row in _MANIFEST["documents"]}
_DIAGRAMS = {}
for _row in _MANIFEST["diagrams"]:
    _DIAGRAMS.setdefault(_row["documentId"], []).append(_row)


def _asset_url(page, asset_path):
    destination = posixpath.dirname(page.file.dest_uri)
    return posixpath.relpath(asset_path, destination or ".")


def on_page_content(content, page, config, files):
    document_id = page.file.src_uri[:-3] if page.file.src_uri.endswith(".md") else None
    document = _DOCUMENTS.get(document_id)
    if document is None:
        return content
    description = document.get("description")
    header = [f'<header class="spike-page-header"><h1>{html.escape(document["title"])}</h1>']
    if description:
        header.append(f'<p>{html.escape(description)}</p>')
    header.append("</header>")
    figures = []
    for diagram in _DIAGRAMS.get(document_id, []):
        asset = html.escape(_asset_url(page, diagram["asset"]["path"]), quote=True)
        title = html.escape(diagram["title"])
        alt = html.escape(diagram["description"], quote=True)
        figures.append(
            f'<figure class="spike-diagram"><figcaption><strong>{title}</strong>'
            f'<span>{html.escape(diagram["description"])}</span></figcaption>'
            f'<a href="{asset}"><img src="{asset}" alt="{alt}"></a>'
            f'<p><a href="{asset}">Open full-size diagram: {title}</a></p></figure>'
        )
    return "".join(header + figures) + content
