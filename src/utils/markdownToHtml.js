import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

export function markdownToHtml(md) {
  return marked.parse(md || '');
}

export function wrapAsDocument(htmlFragment, title = 'Documento') {
  const safeTitle = String(title).replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
  }[c]));
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1f2937; }
  h1, h2, h3, h4 { line-height: 1.25; margin-top: 1.6em; margin-bottom: 0.5em; }
  h1 { font-size: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  h2 { font-size: 1.5rem; }
  h3 { font-size: 1.25rem; }
  p { margin: 0.75em 0; }
  ul, ol { padding-left: 1.5em; }
  code { background: #f3f4f6; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
  pre { background: #f3f4f6; padding: 1em; border-radius: 6px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; }
  blockquote { border-left: 4px solid #d1d5db; margin: 1em 0; padding: 0.25em 1em; color: #4b5563; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #e5e7eb; padding: 0.5em 0.75em; text-align: left; }
  th { background: #f9fafb; }
  img { max-width: 100%; height: auto; }
  a { color: #6d28d9; }
</style>
</head>
<body>
${htmlFragment}
</body>
</html>`;
}
