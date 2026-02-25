#!/usr/bin/env python3
"""Convert the DondeAI system documentation from Markdown to PDF."""

import markdown
from weasyprint import HTML

MD_FILE = "donde-match-system-v3.6.md"
PDF_FILE = "donde-match-system-v3.6.pdf"

# Read markdown
with open(MD_FILE, "r") as f:
    md_content = f.read()

# Convert to HTML
html_body = markdown.markdown(
    md_content,
    extensions=["tables", "fenced_code", "toc", "sane_lists"],
)

# Wrap in styled HTML
html_full = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{
    size: A4;
    margin: 2cm 2.5cm;
    @bottom-center {{
      content: counter(page);
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 9pt;
      color: #888;
    }}
  }}
  body {{
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1a1a1a;
    max-width: 100%;
  }}
  h1 {{
    font-size: 22pt;
    color: #111;
    border-bottom: 2px solid #333;
    padding-bottom: 8px;
    margin-top: 0;
    page-break-before: avoid;
  }}
  h2 {{
    font-size: 16pt;
    color: #222;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
    margin-top: 28px;
    page-break-after: avoid;
  }}
  h3 {{
    font-size: 12pt;
    color: #333;
    margin-top: 18px;
    page-break-after: avoid;
  }}
  h4 {{
    font-size: 10.5pt;
    color: #444;
    margin-top: 14px;
  }}
  table {{
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 9.5pt;
    page-break-inside: auto;
  }}
  th, td {{
    border: 1px solid #ddd;
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
  }}
  th {{
    background-color: #f5f5f5;
    font-weight: 600;
    color: #333;
  }}
  tr:nth-child(even) {{
    background-color: #fafafa;
  }}
  code {{
    font-family: 'JetBrains Mono', 'Menlo', 'Monaco', monospace;
    font-size: 9pt;
    background-color: #f4f4f4;
    padding: 1px 4px;
    border-radius: 3px;
  }}
  pre {{
    background-color: #f4f4f4;
    padding: 12px 16px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 8.5pt;
    line-height: 1.4;
    page-break-inside: avoid;
    border: 1px solid #e0e0e0;
  }}
  pre code {{
    background: none;
    padding: 0;
  }}
  blockquote {{
    border-left: 3px solid #666;
    margin: 12px 0;
    padding: 8px 16px;
    color: #555;
    background: #f9f9f9;
    font-style: italic;
  }}
  strong {{
    color: #111;
  }}
  hr {{
    border: none;
    border-top: 1px solid #ddd;
    margin: 20px 0;
  }}
  a {{
    color: #1a73e8;
    text-decoration: none;
  }}
  ul, ol {{
    padding-left: 24px;
  }}
  li {{
    margin-bottom: 3px;
  }}
  p {{
    margin: 8px 0;
  }}
  em {{
    color: #555;
  }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

# Generate PDF
HTML(string=html_full).write_pdf(PDF_FILE)
print(f"PDF generated: {PDF_FILE}")
