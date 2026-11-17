'use strict';
// validateUpload · จุดฝัง BUG_MODE B02 (ขนาดไฟล์)
// คืน { ok:true, type } หรือ { ok:false, code }
function validateUpload(ctx, { serviceId, docKey, file, existingCount }) {
  const docs = ctx.constants.SERVICE_DOCS[serviceId] || [];
  if (!(docs.includes(docKey) || docKey === 'extra')) return { ok: false, code: 'INVALID_DOC_KEY' };
  if (!file) return { ok: false, code: 'FILE_TYPE' };
  const max = ctx.rules.MAX_FILE_BYTES;
  const tooBig = ctx.bug('B02') ? file.size >= max : file.size > max;
  if (tooBig) return { ok: false, code: 'FILE_TOO_LARGE' };
  const type = ctx.rules.detectFileType(file.buffer);
  if (!type) return { ok: false, code: 'FILE_TYPE' };
  if (docKey === 'plan' && type !== 'pdf') return { ok: false, code: 'PLAN_NOT_PDF' };
  if (existingCount >= ctx.rules.MAX_FILES) return { ok: false, code: 'FILE_COUNT' };
  return { ok: true, type };
}
module.exports = { validateUpload };
