/**
 * CRM Insurance — Gmail welcome-email relay
 *
 * Deploy as a Google Apps Script Web App owned by the Gmail account that
 * should send the messages. The Apps Script project stores the shared secret
 * in Script Properties; it is never included in the frontend bundle.
 */

const CONFIG = {
  secretProperty: 'CRM_WEBHOOK_SECRET',
  senderNameProperty: 'CRM_SENDER_NAME',
  loginUrlProperty: 'CRM_LOGIN_URL',
};

function jsonResponse(body, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse({ ok: true, service: 'crm-insurance-mail-relay' });
}

function doPost(e) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty(CONFIG.secretProperty);

    if (!expectedSecret) {
      return jsonResponse({ ok: false, error: 'relay_not_configured' });
    }

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'invalid_request' });
    }

    const payload = JSON.parse(e.postData.contents);
    if (!payload || payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }

    const to = String(payload.to || '').trim();
    const name = String(payload.name || '').trim();
    const password = String(payload.password || '');
    const loginUrl = String(
      payload.loginUrl || properties.getProperty(CONFIG.loginUrlProperty) || '',
    ).trim();

    if (!isValidEmail(to) || !name || name.length > 160) {
      return jsonResponse({ ok: false, error: 'invalid_recipient' });
    }

    // The relay only accepts the generated initial password shape.
    if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z\d]{8}$/.test(password)) {
      return jsonResponse({ ok: false, error: 'invalid_password_format' });
    }

    if (!isValidHttpUrl(loginUrl)) {
      return jsonResponse({ ok: false, error: 'invalid_login_url' });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(to);
    const safePassword = escapeHtml(password);
    const safeLoginUrl = escapeHtml(loginUrl);
    const senderName = String(
      properties.getProperty(CONFIG.senderNameProperty) || 'CRM Insurance',
    ).trim();

    const subject = 'بيانات الدخول إلى CRM Insurance';
    const plainText = [
      `مرحبًا ${name}`,
      '',
      'تم إنشاء حساب مستخدم لك في نظام CRM Insurance.',
      `البريد الإلكتروني: ${to}`,
      `كلمة المرور: ${password}`,
      `رابط الدخول: ${loginUrl}`,
      '',
      'يمكنك الاستمرار باستخدام كلمة المرور الحالية أو تغييرها بنفسك في أي وقت.',
      'يرجى عدم مشاركة بيانات الدخول مع أي شخص.',
    ].join('\n');

    const htmlBody = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033;max-width:620px;margin:auto">
        <div style="background:#123c69;color:#fff;padding:28px 32px;text-align:center">
          <h1 style="margin:0;font-size:25px">مرحبًا بك في CRM Insurance</h1>
        </div>
        <div style="padding:28px 32px;background:#f7f9fc">
          <p>الأستاذ/ة <strong>${safeName}</strong>،</p>
          <p>تم إنشاء حساب مستخدم لك في نظام CRM Insurance. يمكنك استخدام بيانات الدخول التالية:</p>
          <div style="background:#fff;border:1px solid #dce4ef;padding:18px 20px;margin:22px 0">
            <p style="margin:0 0 8px"><strong>البريد الإلكتروني:</strong> ${safeEmail}</p>
            <p style="margin:0"><strong>كلمة المرور:</strong> <code>${safePassword}</code></p>
          </div>
          <p style="text-align:center;margin:28px 0">
            <a href="${safeLoginUrl}" style="background:#1677c8;color:#fff;text-decoration:none;padding:12px 24px;display:inline-block">فتح صفحة تسجيل الدخول</a>
          </p>
          <p style="font-size:13px;color:#596579">يمكنك الاستمرار بكلمة المرور الحالية أو تغييرها بنفسك من داخل النظام في أي وقت. لا تشارك بيانات الدخول مع أي شخص.</p>
        </div>
      </div>
    `;

    // Prevent two concurrent requests from exceeding the sender quota or
    // producing duplicate welcome messages during a retry.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      GmailApp.sendEmail(to, subject, plainText, {
        htmlBody,
        name: senderName,
      });
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('CRM mail relay error', error && error.message ? error.message : error);
    return jsonResponse({ ok: false, error: 'mail_send_failed' });
  }
}

function isValidEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl(value) {
  // Apps Script does not reliably expose the browser URL constructor.
  // Keep this validation deliberately strict for the production CRM host.
  return /^https:\/\/crm-insurance-project\.vercel\.app(?:\/[^\s]*)?$/.test(value);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
