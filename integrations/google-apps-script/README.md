# Gmail Relay لمستخدمي CRM Insurance

هذا المجلد يحتوي على وسيط بريد يعمل عبر Google Apps Script. وظيفته إرسال بيانات الدخول إلى **مستخدم النظام الجديد** من حساب Gmail المالك للسكريبت. لا علاقة له ببيانات العملاء أو طلبات التأمين.

## الإعداد من حساب Gmail

افتح [script.google.com](https://script.google.com)، أنشئ مشروعًا جديدًا، وانسخ محتوى `send-welcome-email.gs` إلى ملف السكربت. احفظ المشروع، ثم من **Project Settings** أضف Script Properties بالقيم التالية:

| الاسم | القيمة |
|---|---|
| `CRM_WEBHOOK_SECRET` | قيمة عشوائية طويلة لا تقل عن 32 حرفًا، وسيتم استخدامها نفسها داخل Secret في Supabase |
| `CRM_SENDER_NAME` | `CRM Insurance` |
| `CRM_LOGIN_URL` | رابط صفحة تسجيل الدخول على Vercel، ويجب أن يبدأ بـ`https://` |

من **Deploy → New deployment** اختر **Web app**، ثم اجعل التنفيذ **Execute as me**، والسماح بالوصول **Anyone**. وافق على صلاحية إرسال البريد من حساب Gmail عند أول تشغيل. استخدم رابط `/exec` الناتج، وليس رابط `/dev`؛ رابط `/dev` مخصص للاختبار للمحررين فقط وفق وثائق Google.[1]

## الاختبار قبل ربط التطبيق

يمكن اختبار الويب آب بإرسال طلب POST من جهازك، مع استبدال القيم محليًا وعدم حفظها في GitHub:

```bash
curl -i -X POST 'WEB_APP_EXEC_URL' \
  -H 'Content-Type: application/json' \
  --data '{"secret":"YOUR_SHARED_SECRET","to":"your-test-email@example.com","name":"Test User","password":"Ab3kLm9q","loginUrl":"https://your-app.vercel.app/login"}'
```

النتيجة المتوقعة هي JSON يحتوي على `{"ok":true}`، وتصل الرسالة إلى `your-test-email@example.com`. كلمة المرور في الاختبار يجب أن تكون ٨ خانات وتحتوي على حرف كبير وحرف صغير ورقم.

## الربط مع Supabase

بعد نجاح الاختبار، نضع القيم التالية كـSecrets في Edge Function `admin-create-user`:

| Secret | القيمة |
|---|---|
| `GMAIL_RELAY_URL` | رابط `/exec` الخاص بالـWeb App |
| `GMAIL_RELAY_SECRET` | نفس قيمة `CRM_WEBHOOK_SECRET`، ولا تُكتب في الواجهة |
| `APP_LOGIN_URL` | رابط تسجيل الدخول على Vercel |

بعدها تعدّل Edge Function لتوليد كلمة السر على الخادم، وإنشاء مستخدم Auth بها، ثم إرسال طلب HTTPS إلى الويب آب. لا تُرسل كلمة السر إلى React، ولا تُسجل في `activity_logs` أو logs.

## ملاحظات الأمان

الويب آب endpoint عام من ناحية الوصول الشبكي، لذلك الحماية الأساسية هي Secret طويل وعشوائي مع HTTPS. لا تستخدم `doGet` لإرسال البريد، ولا تقبل إلا `doPost` وبيانات JSON الصحيحة. لا تضع كلمة مرور Gmail الأساسية أو Secret داخل GitHub أو `VITE_` environment variables. إذا تم كشف الـSecret، غيّره في Apps Script وفي Supabase معًا.

`GmailApp.sendEmail` يدعم body نصيًا و`htmlBody`، ويعمل تحت صلاحية حساب مالك السكريبت. يجب مراقبة حصص إرسال Gmail؛ في حالة تجاوز الحصة يجب ألا تعود Edge Function بنجاح كاذب.[2]

## المراجع

[1]: https://developers.google.com/apps-script/guides/web "Google Apps Script Web Apps"
[2]: https://developers.google.com/apps-script/reference/gmail/gmail-app "Google Apps Script GmailApp"
