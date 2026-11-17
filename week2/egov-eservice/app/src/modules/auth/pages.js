'use strict';
// หน้า HTML ของ B04: login / register

const LOGIN_BODY = `<h1>เข้าสู่ระบบ e-Service เทศบาลนครตัวอย่าง</h1>
<div role="tablist" aria-label="ประเภทผู้ใช้">
  <button type="button" role="tab" id="tab-c" aria-controls="panel-c" aria-selected="true"  data-testid="login-tab-citizen">ประชาชน (ThaiD จำลอง)</button>
  <button type="button" role="tab" id="tab-s" aria-controls="panel-s" aria-selected="false" data-testid="login-tab-staff">เจ้าหน้าที่</button>
</div>
<section id="panel-c" role="tabpanel" aria-labelledby="tab-c">
  <form id="thaid-form" novalidate>
    <div class="form-row"><label for="thaid-id">เลขบัตรประชาชน 13 หลัก</label>
      <input id="thaid-id" data-testid="thaid-id-input" inputmode="numeric" autocomplete="off"></div>
    <button type="submit" data-testid="thaid-submit">เข้าสู่ระบบด้วย ThaiD (จำลอง)</button>
    <div id="thaid-msg"></div>
  </form>
  <div id="otp-slot"></div>
</section>
<section id="panel-s" role="tabpanel" aria-labelledby="tab-s" hidden>
  <form id="staff-form" novalidate>
    <div class="form-row"><label for="su">ชื่อผู้ใช้</label><input id="su" data-testid="staff-username" autocomplete="username"></div>
    <div class="form-row"><label for="sp">รหัสผ่าน</label><input id="sp" type="password" data-testid="staff-password" autocomplete="current-password"></div>
    <button type="submit" data-testid="staff-submit">เข้าสู่ระบบเจ้าหน้าที่ (SSO ภาครัฐ จำลอง)</button>
    <div id="staff-msg"></div>
  </form>
</section>`;

const LOGIN_SCRIPT = `
(function () {
  var idNo = '';
  var tabC = document.getElementById('tab-c'), tabS = document.getElementById('tab-s');
  var panC = document.getElementById('panel-c'), panS = document.getElementById('panel-s');
  function show(c) {
    panC.hidden = !c; panS.hidden = c;
    tabC.setAttribute('aria-selected', c ? 'true' : 'false');
    tabS.setAttribute('aria-selected', c ? 'false' : 'true');
  }
  tabC.addEventListener('click', function () { show(true); });
  tabS.addEventListener('click', function () { show(false); });
  function thaidError(m) {
    document.getElementById('thaid-msg').innerHTML = '<p data-test' + 'id="thaid-error" role="alert" class="alert-error">' + App.esc(m) + '</p>';
  }
  function lockBox(until) {
    return '<p data-test' + 'id="lock-message" role="alert" class="alert-error">ผิดเกินกำหนด เลขบัตรนี้ถูกล็อก 15 นาที</p>' +
      '<p>ปลดล็อกได้เมื่อ <time data-test' + 'id="lock-until" data-iso="' + App.esc(until) + '" datetime="' + App.esc(until) + '">' +
      App.esc(App.thaiDateTime(until)) + '</time></p>';
  }
  document.getElementById('thaid-form').addEventListener('submit', function (e) {
    e.preventDefault();
    document.getElementById('thaid-msg').innerHTML = '';
    document.getElementById('otp-slot').innerHTML = '';
    idNo = document.getElementById('thaid-id').value.trim();
    App.api('POST', '/api/auth/thaid/start', { idNo: idNo }).then(function (r) {
      if (r.status === 200) {
        document.getElementById('otp-slot').innerHTML =
          '<div data-test' + 'id="otp-step" class="card"><form id="otp-form" novalidate>' +
          '<div class="form-row"><label for="otp">รหัส OTP (โหมดทดสอบใช้ 123456)</label>' +
          '<input id="otp" data-test' + 'id="otp-input" inputmode="numeric" autocomplete="one-time-code"></div>' +
          '<button type="submit" data-test' + 'id="otp-submit">ยืนยัน OTP</button><div id="otp-msg"></div></form></div>';
        document.getElementById('otp-form').addEventListener('submit', onOtp);
        document.getElementById('otp').focus();
      } else if (r.status === 423) {
        document.getElementById('thaid-msg').innerHTML = lockBox(r.data && r.data.lockedUntil);
      } else {
        thaidError((r.data && r.data.message) || 'เกิดข้อผิดพลาด');
      }
    });
  });
  function onOtp(e) {
    e.preventDefault();
    var otp = document.getElementById('otp').value;
    var msg = document.getElementById('otp-msg');
    App.api('POST', '/api/auth/thaid/verify', { idNo: idNo, otp: otp }).then(function (r) {
      if (r.status === 200) {
        location = r.data.registered ? '/citizen' : '/register';
      } else if (r.status === 401) {
        msg.innerHTML = '<p data-test' + 'id="otp-error" role="alert" class="alert-error">รหัส OTP ไม่ถูกต้อง</p>' +
          '<p data-test' + 'id="otp-attempts-left">เหลือ ' + App.esc(r.data && r.data.attemptsLeft) + ' ครั้ง</p>';
      } else if (r.status === 423) {
        msg.innerHTML = lockBox(r.data && r.data.lockedUntil);
      } else {
        thaidError((r.data && r.data.message) || 'เกิดข้อผิดพลาด');
      }
    });
  }
  document.getElementById('staff-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = document.getElementById('staff-msg');
    msg.innerHTML = '';
    App.api('POST', '/api/auth/staff/login', {
      username: document.getElementById('su').value, password: document.getElementById('sp').value
    }).then(function (r) {
      if (r.status === 200) location = r.data.landing;
      else msg.innerHTML = '<p data-test' + 'id="staff-error" role="alert" class="alert-error">ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</p>';
    });
  });
})();`;

const REG_SCRIPT = `
(function () {
  document.getElementById('reg-form').addEventListener('submit', function (e) {
    e.preventDefault();
    document.getElementById('err-mobile').innerHTML = '';
    document.getElementById('err-consent').innerHTML = '';
    App.api('POST', '/api/auth/register', {
      mobile: document.getElementById('rm').value,
      email: document.getElementById('re').value,
      consent: document.getElementById('rc').checked
    }).then(function (r) {
      if (r.status === 201) location = '/citizen';
      else if (r.status === 401) location = '/login';
      else if (r.data && r.data.code === 'INVALID_MOBILE')
        document.getElementById('err-mobile').innerHTML = '<p data-test' + 'id="reg-error-mobile" role="alert" class="alert-error">เบอร์มือถือต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0</p>';
      else if (r.data && r.data.code === 'CONSENT_REQUIRED')
        document.getElementById('err-consent').innerHTML = '<p data-test' + 'id="reg-error-consent" role="alert" class="alert-error">กรุณายินยอมการประมวลผลข้อมูลส่วนบุคคล (PDPA)</p>';
      else App.showError((r.data && r.data.message) || 'เกิดข้อผิดพลาด');
    });
  });
})();`;

function loginPage() {
  return { title: 'เข้าสู่ระบบ', body: LOGIN_BODY, script: LOGIN_SCRIPT };
}

function registerPage(name, esc) {
  const body = `<h1>ลงทะเบียนใช้งานครั้งแรก</h1>
<form id="reg-form" novalidate>
  <div class="form-row"><label for="rn">ชื่อ-สกุล (จาก ThaiD แก้ไขไม่ได้)</label>
    <input id="rn" data-testid="reg-name" value="${esc(name)}" readonly></div>
  <div class="form-row"><label for="rm">เบอร์มือถือ (บังคับ)</label>
    <input id="rm" data-testid="reg-mobile" inputmode="numeric" autocomplete="tel"><div id="err-mobile"></div></div>
  <div class="form-row"><label for="re">อีเมล (ไม่บังคับ)</label>
    <input id="re" data-testid="reg-email" inputmode="email" autocomplete="email"></div>
  <div class="form-row"><span><input type="checkbox" id="rc" data-testid="reg-consent">
    <label for="rc">ข้าพเจ้ายินยอมให้เทศบาลนครตัวอย่างประมวลผลข้อมูลส่วนบุคคลตาม PDPA เพื่อให้บริการนี้</label></span><div id="err-consent"></div></div>
  <button type="submit" data-testid="reg-submit">ลงทะเบียน</button>
</form>`;
  return { title: 'ลงทะเบียน', body, script: REG_SCRIPT };
}

module.exports = { loginPage, registerPage };
