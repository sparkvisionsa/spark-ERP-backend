# Spark ERP API

خادم NestJS لنظام Spark ERP، ويشمل المصادقة وإدارة الموظفين والمشاريع والمهام والمهام الفرعية وبنود التنفيذ والتسليمات والصلاحيات.

## التشغيل

1. انسخ `.env.example` إلى `.env` واضبط متغيرات MongoDB وJWT.
2. ثبّت الحزم: `npm install`
3. جهّز حساب مدير النظام: `npm run seed`
4. شغّل الخادم: `npm run start:dev`

الخادم يعمل افتراضياً على `http://localhost:4000`، وتوثيق Swagger على `http://localhost:4000/api/docs`.

## الصلاحيات

- `SUPER_ADMIN`: إدارة الموظفين والمشاريع كاملة.
- `SUPERVISOR`: إدارة مشاريع شركته وتعيين موظفي الشركة، دون إنشاء أو تعديل أو حذف الموظفين.
- `EMPLOYEE`: قراءة المشاريع المعيّن فيها فقط.

مساحة العمل المجمعة متاحة عبر `GET /api/workspace/tree?projectId=`، مع نقاط REST مستقلة تحت `tasks` و`subtasks` و`items` و`deliveries`.

تُخزّن رموز الدخول في Cookies من نوع `httpOnly`. كل كلمات المرور مشفرة بـ bcrypt ولا تُخزن كنص صريح.
