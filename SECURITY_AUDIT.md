# تقرير التدقيق الأمني — CRM Insurance

## حالة التقرير ونطاقه

تم تحديث هذا التقرير بعد تنفيذ التغييرات فعليًا على مشروع Supabase الصحيح **insurance-crm** ذي المعرّف `mqprutudyyzghpiiopqo` في منطقة `eu-central-1`. شمل التدقيق كود الواجهة، المصادقة، Edge Functions، سياسات RLS وmigrations، التخزين المحلي وعمليات offline، الطباعة والتصدير، استيراد الملفات، بوابة الذكاء الاصطناعي، إعدادات Vercel، التبعيات، وصلاحيات دوال PostgreSQL.

> **مهم:** هذا التقرير لا يدّعي الوصول إلى صفر ثغرات؛ بل يميّز بين الإصلاحات المطبقة، الاستثناءات المطلوبة، والتحذيرات التي ما زالت مقصودة أو تحتاج قرارًا تشغيليًا.

## الاستثناء المطلوب من صاحب النظام

تم الإبقاء على سلوك إنشاء المستخدم الجديد بكلمة السر الثابتة `123456`، مع تثبيت هذا السلوك داخل Edge Function على الخادم نفسه، بحيث لا يستطيع جسم الطلب تغيير كلمة السر الابتدائية عند استدعاء الدالة مباشرة. يظل المستخدم الجديد مسؤولًا عن تغيير كلمة السر بعد تسجيل الدخول. هذا الاستثناء مقصود، ولذلك لم يتم تفعيل حماية كلمات السر المسرّبة التي قد تمنع كلمة السر الابتدائية المطلوبة.

## الإصلاحات المطبقة في الكود

| المجال | الإجراء والنتيجة |
|---|---|
| تصعيد الصلاحيات | إضافة trigger في قاعدة البيانات يمنع المستخدم من تعديل دوره أو مديره أو بريده أو حالته أو حقول الصلاحيات الخاصة به عبر تحديث مباشر من المتصفح. |
| الحسابات المعطلة والمحذوفة | منع تحميل ملف الحساب غير النشط أو المحذوف، وإضافة فحوص حالة المستدعي إلى الوظائف الإدارية وبوابة الذكاء الاصطناعي. |
| إنشاء المستخدمين | تثبيت كلمة السر الابتدائية `123456` داخل الخادم مع الإبقاء على فحوص الصلاحية والنطاق الهرمي. |
| العمليات الأوفلاين | مسح طابور العمليات الحساسة وذاكرة البيانات المؤقتة عند تسجيل الخروج، لأن الطابور قد يحتوي على بيانات عملاء ووثائق. |
| HTML Injection | تهريب بيانات العملاء والوثائق وعنوان نافذة الطباعة قبل إدخالها في `document.write`. |
| بوابة الذكاء الاصطناعي | إضافة فحص المستخدم النشط، حدود حجم الطلب، عدد الرسائل والأجزاء والصور والنصوص والـtokens، تقييد الحرارة، السماح بمصادر الصور Data URL فقط، ومنع الطلبات غير الآمنة إلى عناوين خارجية، مع rate limit مؤقت لكل مستخدم داخل عزل Edge Function. |
| استيراد الملفات | فرض حد 10MB، وحدود للأوراق والصفوف، والسماح بالامتدادات المناسبة، مع منع Formula Injection في تقرير الأخطاء. |
| Headers | إضافة HSTS وCSP وCORP وX-Permitted-Cross-Domain-Policies، مع الإبقاء على X-Frame-Options وnosniff وReferrer-Policy. |
| التبعيات | تحديث `jspdf` إلى `4.2.1`، وتثبيت override لإصدار `DOMPurify` الآمن، وتحديث React Router وفق التغييرات المنفذة. |
| المستودع | إضافة `.gitignore` لمنع رفع `node_modules` و`dist` وملفات البيئة. |

## تغييرات قاعدة البيانات المطبقة فعليًا

تم تنفيذ migrations على مشروع `insurance-crm` فقط. لم يتم تعديل أي من مشروعي Supabase السابقين غير الصحيحين.

| Migration | النتيجة |
|---|---|
| `security_hardening_20260825` | تثبيت search path لبعض الدوال، منع إنشاء إشعارات تشغيلية مزيفة من العميل، وإضافة حماية trigger ضد تعديل الصلاحيات الذاتية. |
| `revoke_anon_function_execution_20260825` | سحب تنفيذ الدوال الحساسة من `anon` صراحةً، مع الإبقاء فقط على `get_email_by_phone(text)` لتدفق تسجيل الدخول الحالي. |
| `authenticated_rpc_allowlist_20260825` | تقليص صلاحيات `authenticated` إلى allowlist من RPCs التي يستدعيها كود الواجهة فعليًا؛ الدوال الداخلية والـcron والـtriggers لا تُمنح للعميل تلقائيًا. |
| `fix_remaining_function_search_paths_20260825` | تثبيت `search_path = public` للدوال الأربع التي بقيت عليها ملاحظة mutable search path. |
| `remove_internal_messaging_system_20260825` | حذف بيانات وجداول ودوال وحالات Realtime الخاصة بالرسائل الفردية وغرفة الفريق، مع تنظيف إشعارات وسجلات الرسائل ذات الصلة. |

## حذف نظام الرسائل والتحقق منه

تم تنفيذ طلب حذف نظام الرسائل بالكامل على قاعدة البيانات، بالإضافة إلى إزالة الواجهة والمسارات والأزرار من الكود في التغييرات السابقة. بعد التطبيق، لم تعد جداول `conversations` أو `conversation_members` أو `messages` أو `message_reads` أو `typing_status` أو `online_status` أو `team_room_messages` أو `team_room_read_state` ظاهرة ضمن جداول `public`، كما أعاد استعلام التحقق المحدود عن دوال الرسائل والمحادثات وteam room نتيجة فارغة. بقيت جداول التشغيل مثل `users` و`customers` و`policies` و`installments` و`payments` و`notifications` دون حذف.

## نشر Edge Functions

تم نشر النسخ المحسنة مباشرة إلى Supabase؛ نشر Vercel وحده لا ينشر Edge Functions.

| الوظيفة | الحالة بعد النشر | الإصدار | `verify_jwt` |
|---|---:|---:|---:|
| `admin-create-user` | ACTIVE | 16 | true |
| `admin-update-user` | ACTIVE | 14 | true |
| `ai-gateway` | ACTIVE | 8 | true |
| `ai-test-connection` | ACTIVE | 6 | true |

## نتائج فحص Supabase Advisor بعد التطبيق

أُعيد تشغيل Security Advisor بعد تطبيق migrations وحذف الرسائل. اختفت تحذيرات `function_search_path_mutable`، واختفت تحذيرات الدوال الخاصة بنظام الرسائل بعد حذفها. النتائج المتبقية مصنفة كالتالي:

| المستوى | النتيجة المتبقية | القرار أو الإجراء |
|---|---|---|
| INFO | جدول `webauthn_challenges` لديه RLS بلا policies. | مقصود؛ الجدول مخصص لخدمات WebAuthn الموثوقة ولا يُمنح له وصول عميل مباشر. |
| WARN | الامتداد `pg_trgm` موجود في schema `public`. | لم يتم نقله تلقائيًا لتجنب كسر فهارس البحث الحالية؛ يحتاج migration مستقلة مع اختبار الفهارس قبل التنفيذ. [1] |
| WARN | `get_email_by_phone(text)` قابل للتنفيذ من `anon`. | مقصود لتدفق تسجيل الدخول برقم الهاتف، ويظل خطر enumeration مقيدًا بضرورة إضافة rate limiting على مستوى مسار الدخول أو Edge Function. [2] |
| WARN | بعض RPCs الضرورية للواجهة ما زالت `SECURITY DEFINER` وقابلة للتنفيذ من `authenticated`. | هذه ليست صلاحية شاملة؛ هي allowlist محددة من RPCs يستدعيها التطبيق، بينما الدوال غير اللازمة للمستخدم الموثق سُحبت منها الصلاحية. يجب الحفاظ على فحوص الصلاحية الداخلية في كل RPC. [2] |
| WARN | حماية كلمات السر المسرّبة في Supabase Auth غير مفعلة. | تُركت معطلة تنفيذًا للاستثناء الصريح الخاص بكلمة السر الابتدائية الثابتة `123456`. هذه مخاطرة مقبولة ومعلنة وليست نتيجة نسيان. [3] |

## مخاطر متبقية أو قرارات مقيدة

| المستوى | الملاحظة | التخفيف الحالي |
|---|---|---|
| مرتفع | حزمة `xlsx@0.18.5` ما زالت تحمل تحذيرًا عاليًا ولا يتوفر لها إصدار إصلاح منشور مناسب من npm. | تم تقليل مساحة الخطر بحدود الحجم والأوراق والصفوف ومنع Formula Injection؛ الاستبدال بمحلل Excel مُصان هو الإجراء الأفضل لاحقًا. لا ينبغي وصف المشروع بأنه خالٍ من الثغرات. |
| متوسط | البحث عن البريد برقم الهاتف يكشف نتيجة لازمة لتدفق تسجيل الدخول. | بقيت الدالة متاحة للـanon فقط لهذا الغرض؛ يلزم rate limiting ومراقبة محاولات enumeration على مسار الدخول. |
| متوسط/تشغيلي | بوابة AI تستخدم rate limit داخل الذاكرة لكل Edge isolate، وليس مخزنًا موزعًا. | توجد حدود طلبات ومحتوى ومستخدم نشط؛ الحماية الموزعة تحتاج Redis أو آلية Supabase مركزية إذا ارتفع حجم الاستخدام. |
| منخفض/دفاعي | Edge Functions تستخدم CORS wildcard مع اعتمادها على Bearer token والتحقق من JWT. | لا يوجد مفتاح service role في المتصفح، وفحوص الجلسة والحالة قائمة؛ يمكن تقييد Origins لاحقًا بعد تثبيت النطاقات الرسمية. |
| منخفض | الامتداد `pg_trgm` في `public`. | لم يُنقل تلقائيًا لأن النقل قد يتطلب إعادة بناء فهارس؛ يوصى باختباره في فرع قاعدة بيانات قبل production. |

## نتائج التحقق البرمجية

تم التحقق من نجاح `npm run build` و`git diff --check` في دورة التدقيق السابقة، كما تم تشغيل validator مخصص لتوقيعات migration الأمنية ونتيجته `missing_matching_grants: none` و`extra_grants: none` بعد إزالة أسطر الرسائل. يظل `npm run lint` و`npm run typecheck` محتويين على أخطاء وتحذيرات baseline موجودة مسبقًا وخارج نطاق إصلاحات التدقيق. كما يظل `npm audit --omit=dev` متضمنًا تحذيرًا عاليًا واحدًا مباشرًا متعلقًا بـ`xlsx`.

## الملفات الأساسية المتغيرة

| الملف أو المسار | الغرض |
|---|---|
| `supabase/functions/admin-create-user/index.ts` | تثبيت كلمة السر الابتدائية وفحص حالة المستدعي والنطاق. |
| `supabase/functions/admin-update-user/index.ts` | حماية تحديث المستخدمين وفحص حالة المستدعي والصلاحيات. |
| `supabase/functions/ai-gateway/index.ts` | حدود الطلبات ومصادر الصور وrate limit وفحص الحساب. |
| `supabase/functions/ai-test-connection/index.ts` | حماية اختبار مزودي الذكاء الاصطناعي للمشرف الأعلى. |
| `supabase/migrations/20260825000000_remove_internal_messaging_system.sql` | حذف الرسائل الفردية وغرفة الفريق وبياناتها. |
| `supabase/migrations/20260825010000_security_hardening.sql` | hardening وtrigger وsearch path وصلاحيات الدوال غير المرتبطة بالرسائل. |
| `supabase/migrations/20260825020000_revoke_anon_function_execution.sql` | سحب صلاحيات `anon` الصريحة. |
| `supabase/migrations/20260825030000_authenticated_rpc_allowlist.sql` | allowlist دقيقة لصلاحيات `authenticated`. |
| `supabase/migrations/20260825040000_fix_remaining_function_search_paths.sql` | إصلاح تحذيرات search path المتبقية. |
| `src/hooks/useAuth.tsx` و`src/lib/offlineQueue.ts` | تنظيف الجلسة والطابور عند تسجيل الخروج. |
| `src/lib/htmlEscape.ts` وملفات الطباعة والتصدير | منع إدخال HTML غير موثوق. |
| `src/pages/DataImport/services/dataImportService.ts` | حدود الاستيراد وحماية Formula Injection. |
| `vercel.json` و`package.json` و`.gitignore` | headers والتبعيات وحماية المستودع. |

## مراجع

[1]: https://supabase.com/docs/guides/database/database-linter "Supabase Database Linter"
[2]: https://supabase.com/docs/guides/database/functions "Supabase Database Functions"
[3]: https://supabase.com/docs/guides/auth/password-security "Supabase Password Security"
