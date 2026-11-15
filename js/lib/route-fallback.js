// Pure helpers for detecting 404 Markdown fetch failures and choosing recovery targets.

/**
 * Returns true when an error represents an HTTP 404 while fetching a Markdown (.md) document.
 */
export function isMarkdown404Error(err) {
  if (!err) return false;
  if (typeof err === 'object') {
    const status = Number(err.status);
    const path = String(err.path || '');
    if (status === 404 && (err.isMarkdown || /\.md(?:$|[?#])/i.test(path))) {
      return true;
    }
  }
  const msg = String((typeof err === 'object' && err.message) || err);
  return /^404\b[^\n]*\.md(?:\b|[?#]|$)/i.test(msg.trim());
}

/**
 * Extracts the missing Markdown file path from a 404 error when present.
 */
export function extractMissingMarkdownPath(err) {
  if (!err) return '';
  if (typeof err === 'object' && typeof err.path === 'string' && /\.md/i.test(err.path)) {
    return err.path;
  }
  const msg = String((typeof err === 'object' && err.message) || err);
  const match = msg.match(/\b([^\s]+\.md(?:[?#][^\s]*)?)\b/i);
  return match ? match[1] : '';
}

/**
 * Computes a secondary fallback link (module or course map) when a lesson/quiz/game Markdown 404s.
 */
export function fallbackDashboardTarget(params = {}) {
  const cid = params && typeof params.course === 'string' ? params.course.trim() : '';
  const mid = params && typeof params.module === 'string' ? params.module.trim() : '';
  if (cid && mid) {
    return { href: `#/c/${encodeURIComponent(cid)}/${encodeURIComponent(mid)}`, label: 'Back to module' };
  }
  if (cid) {
    return { href: `#/c/${encodeURIComponent(cid)}`, label: 'Browse course map' };
  }
  return { href: '#/c/python', label: 'Browse course map' };
}
