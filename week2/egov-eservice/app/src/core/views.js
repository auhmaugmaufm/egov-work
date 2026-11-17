'use strict';
// ชิ้น HTML ที่ใช้ร่วม (SPEC/B02 ข้อ 4) · เขียนโดย Z1 (B02 ไม่ได้เขียนไว้ ดู QUESTIONS-B02 Q2)
const crypto = require('crypto');
const { esc } = require('./layout');
const { STATUS_TH, LEVEL_TH, DOC_KEY_TH } = require('./constants');
const rules = require('./rules');

function statusBadge(status, testid = 'case-status') {
  return `<span data-testid="${esc(testid)}" data-status="${esc(status)}" class="badge st-${esc(status)}">${esc(STATUS_TH[status] || status)}</span>`;
}
function levelBadge(level, testid = 'sla-level') {
  if (!level) return '';
  return `<span data-testid="${esc(testid)}" data-level="${esc(level)}" class="badge lv-${esc(level)}">${esc(LEVEL_TH[level] || level)}</span>`;
}
function timeEl(iso, testid, prefix = '') {
  if (!iso) return '';
  return `<time data-testid="${esc(testid)}" data-iso="${esc(iso)}" datetime="${esc(iso)}">${esc(prefix)}${esc(rules.formatThaiDateTime(iso))}</time>`;
}
function dateEl(day, testid) {
  if (!day) return '';
  return `<time data-testid="${esc(testid)}" data-iso="${esc(day)}" datetime="${esc(day)}">${esc(rules.formatThaiDate(day))}</time>`;
}
function timelineHtml(events) {
  const items = (events || []).map((e) =>
    `<li data-testid="timeline-item" data-iso="${esc(e.at)}">${esc(rules.formatThaiDateTime(e.at))} · ${esc(e.text)}</li>`).join('');
  return `<ol data-testid="case-timeline">${items}</ol>`;
}
function docItemsHtml(files) {
  const items = (files || []).map((f) =>
    `<li data-testid="doc-item" data-name="${esc(f.name)}" data-file-id="${esc(f.id)}">${esc(DOC_KEY_TH[f.doc_key] || f.doc_key)}: <a data-testid="doc-download-link" href="/api/files/${esc(f.id)}">${esc(f.name)}</a></li>`).join('');
  return `<ul class="doc-list">${items}</ul>`;
}
function qrBox({ testid, label, dataUrl = null, seed }) {
  const h = crypto.createHash('sha256').update(String(seed)).digest();
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#000"/>`;
  let cells = '';
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
    const i = y * 21 + x;
    if ((h[(i >> 3) % 32] >> (i & 7)) & 1) cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="#000"/>`;
  }
  const du = dataUrl ? ` data-url="${esc(dataUrl)}"` : '';
  return `<div data-testid="${esc(testid)}" class="qr" role="img" aria-label="${esc(label)}"${du}><svg viewBox="0 0 21 21" width="168" height="168" aria-hidden="true" focusable="false"><rect width="21" height="21" fill="#fff"/>${finder(0, 0)}${finder(14, 0)}${finder(0, 14)}${cells}</svg></div>`;
}

module.exports = { statusBadge, levelBadge, timeEl, dateEl, timelineHtml, docItemsHtml, qrBox };
