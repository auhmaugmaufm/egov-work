'use strict';

function makeSimplePdf(lines) {
  const esc = (line) => {
    let s = '';
    for (const ch of String(line)) {
      const c = ch.codePointAt(0);
      s += (c > 126 || c < 32) ? '?' : ch;
    }
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  };
  let stream = 'BT /F1 11 Tf 14 TL 50 800 Td';
  lines.forEach((l, i) => { stream += (i === 0 ? ' ' : ' T* ') + `(${esc(l)}) Tj`; });
  stream += ' ET';
  const streamLen = Buffer.byteLength(stream, 'latin1');
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    `5 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  for (const o of objs) { offsets.push(Buffer.byteLength(out, 'latin1')); out += o; }
  const xrefPos = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 6\n0000000000 65535 f \n';
  for (const off of offsets) out += String(off).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

module.exports = { makeSimplePdf };
