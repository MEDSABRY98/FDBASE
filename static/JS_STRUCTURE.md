# JavaScript File Structure

## Overview
تم دمج جميع ملفات JavaScript في ملف واحد منظم `app.js` لسهولة الصيانة والتنظيم.

## File Organization

### `static/app.js` - الملف الرئيسي الوحيد

#### SECTION 1: GENERAL FUNCTIONS (SHARED ACROSS ALL TABS)
- `switchTab()` - تبديل التابات
- `saveCurrentForm()` - حفظ النموذج الحالي
- `resetCurrentForm()` - إعادة تعيين النموذج
- `exportCurrentData()` - تصدير البيانات الحالية
- `exportFormData()` - تصدير بيانات النموذج
- `exportLineupData()` - تصدير بيانات التشكيل

#### SECTION 2: MIN TOTAL CALCULATION (SHARED FOR LINEUP TABS)
- `calculateMinTotalForRow()` - حساب Min Total للصف
- `updateAllMinTotals()` - تحديث جميع حسابات Min Total

#### SECTION 3: AHLY LINEUP FUNCTIONS
- `addPlayerRow()` - إضافة صف لاعب
- `removePlayerRow()` - حذف صف لاعب
- `addEventListenersToRow()` - إضافة مستمعي الأحداث
- `clearAllPlayers()` - مسح جميع اللاعبين

#### SECTION 4: EGYPT LINEUP FUNCTIONS
- `addEgyptPlayerRow()` - إضافة صف لاعب مصر
- `removeEgyptPlayerRow()` - حذف صف لاعب مصر
- `addEventListenersToEgyptRow()` - إضافة مستمعي الأحداث لمصر
- `clearAllEgyptPlayers()` - مسح جميع لاعبي مصر

#### SECTION 5: AHLY PKS FUNCTIONS
- `addAhlyPlayerRow()` - إضافة صف لاعب الأهلي
- `removeAhlyPlayerRow()` - حذف صف لاعب الأهلي
- `addOpponentPlayerRow()` - إضافة صف لاعب الخصم
- `removeOpponentPlayerRow()` - حذف صف لاعب الخصم
- `clearAllAhlyPlayers()` - مسح جميع لاعبي الأهلي
- `clearAllOpponentPlayers()` - مسح جميع لاعبي الخصم

#### SECTION 6: AHLY MATCH FUNCTIONS (Goals & Assists + GKS)
**Goals & Assists Functions:**
- `addGoalsAssistsEntry()` - إضافة إدخال أهداف وتمريرات
- `removeGoalsAssistsEntry()` - حذف إدخال أهداف وتمريرات
- `clearGoalsAssists()` - مسح جميع الأهداف والتمريرات

**GKS Functions:**
- `addGKSEntry()` - إضافة إدخال حراس المرمى
- `removeGKSEntry()` - حذف إدخال حراس المرمى
- `clearGKS()` - مسح جميع حراس المرمى

#### SECTION 7: EXCEL UTILITIES
- `createExcelFromFormData()` - إنشاء Excel من بيانات النموذج
- `createExcelFromData()` - إنشاء Excel من بيانات التشكيل
- `createPKSExcelFromData()` - إنشاء Excel لركلات الترجيح

#### SECTION 8: INITIALIZATION
- تهيئة التطبيق عند تحميل الصفحة
- إضافة مستمعي الأحداث للصفوف الموجودة
- تحديث جميع حسابات Min Total

## Benefits of This Structure

1. **سهولة الصيانة**: ملف واحد بدلاً من 5 ملفات
2. **تنظيم واضح**: كل قسم له وظيفة محددة
3. **تقليل التكرار**: الوظائف المشتركة في مكان واحد
4. **أداء أفضل**: تحميل ملف واحد بدلاً من عدة ملفات
5. **سهولة التطوير**: كل شيء في مكان واحد

## Migration Notes

تم حذف الملفات التالية:
- `static/script.js` (تم دمجها في `app.js`)
- `static/ahly-lineup.js` (تم دمجها في `app.js`)
- `static/ahly-pks.js` (تم دمجها في `app.js`)
- `static/egypt-lineup.js` (تم دمجها في `app.js`)
- `static/excel-utils.js` (تم دمجها في `app.js`)

تم تحديث `templates/base.html` لاستخدام `app.js` بدلاً من `script.js`.
