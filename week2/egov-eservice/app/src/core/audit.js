'use strict';
const { AUDIT_EVENTS } = require('./constants');

function makeAudit(db, clock) {
  return function audit(actor, f) {
    const { event, caseNo = null, fromStatus = null, toStatus = null, detail = '' } = f || {};
    if (!AUDIT_EVENTS.includes(event)) throw new Error('unknown audit event: ' + event);
    db.prepare(`INSERT INTO audit_log(time, username, role, event, case_no, from_status, to_status, detail)
                VALUES (?,?,?,?,?,?,?,?)`)
      .run(clock.nowIso(), actor ? actor.username ?? null : null, actor ? actor.role ?? null : null,
        event, caseNo, fromStatus, toStatus, detail ?? '');
  };
}

function makeCaseEvent(db, clock) {
  return function caseEvent(caseId, type, text, at) {
    db.prepare('INSERT INTO case_events(case_id, at, type, text) VALUES (?,?,?,?)')
      .run(caseId, at ?? clock.nowIso(), type, text);
  };
}

module.exports = { makeAudit, makeCaseEvent };
