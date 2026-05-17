import React from "react";

const sectionStyle = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  padding: "18px",
  marginBottom: "14px",
};

const headingStyle = {
  color: "#7ddbcd",
  margin: "0 0 10px",
  fontSize: "20px",
};

const paragraphStyle = {
  color: "#d1d5db",
  lineHeight: 1.9,
  margin: "0 0 10px",
  fontSize: "15px",
};

const listStyle = {
  color: "#d1d5db",
  lineHeight: 1.9,
  margin: "0",
  paddingRight: "22px",
  fontSize: "15px",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        direction: "rtl",
        textAlign: "right",
        maxWidth: "900px",
        margin: "0 auto",
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      <header style={{ marginBottom: "24px" }}>
        <p
          style={{
            display: "inline-block",
            color: "#7ddbcd",
            border: "1px solid rgba(125,219,205,0.35)",
            borderRadius: "999px",
            padding: "7px 12px",
            margin: "0 0 14px",
            fontSize: "14px",
          }}
        >
          آخر تحديث: 16 مايو 2026
        </p>
        <h1 style={{ color: "#fff", margin: 0, fontSize: "34px" }}>
          سياسة الخصوصية
        </h1>
        <p style={{ ...paragraphStyle, marginTop: "12px", color: "#b8c2c0" }}>
          توضح هذه السياسة كيف تتعامل منصة دربك مع البيانات عند استخدام الموقع
          أو إضافة تجربة تدريبية.
        </p>
      </header>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>البيانات التي نجمعها</h2>
        <ul style={listStyle}>
          <li>بيانات التجربة التي يدخلها المستخدم، مثل اسم الجهة، المدينة، التخصص، مدة التدريب، طريقة التقديم، التقييم، ووصف التجربة.</li>
          <li>بيانات تقنية محدودة قد تشمل نوع المتصفح، الجهاز، الصفحات التي تمت زيارتها، وأوقات الاستخدام لأغراض التحسين والحماية.</li>
          <li>لا تطلب دربك إنشاء حساب، ولا تطلب الاسم الحقيقي للطالب عند إضافة التجربة.</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>أغراض استخدام البيانات</h2>
        <ul style={listStyle}>
          <li>عرض التجارب الطلابية ومساعدة الزوار على البحث والمقارنة.</li>
          <li>تحسين تجربة المستخدم، ترتيب المحتوى، واكتشاف المشاكل التقنية.</li>
          <li>حماية المنصة من الإساءة، السبام، أو المحتوى المخالف.</li>
          <li>الاستجابة لطلبات المراجعة أو الحذف عند الحاجة.</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>إخفاء الهوية وحماية الخصوصية</h2>
        <p style={paragraphStyle}>
          صممت دربك لتكون مشاركة التجارب بدون إظهار هوية الطالب. لذلك ننصح
          المستخدم بعدم كتابة أي معلومات قد تكشف هويته أو هوية أشخاص آخرين،
          مثل الأسماء الشخصية، أرقام التواصل، البريد الإلكتروني، الروابط
          الخاصة، أو تفاصيل داخلية حساسة.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>مشاركة البيانات مع أطراف أخرى</h2>
        <p style={paragraphStyle}>
          لا تبيع دربك بيانات المستخدمين. قد تستخدم المنصة خدمات تشغيل وتحليل
          واستضافة مثل خدمات الاستضافة وقاعدة البيانات والتحليلات، وذلك لتشغيل
          الموقع وقياس الأداء وتحسينه. تتعامل هذه الخدمات مع البيانات بالقدر
          اللازم لتقديم الخدمة.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>الاحتفاظ والحذف</h2>
        <p style={paragraphStyle}>
          قد تبقى التجارب منشورة ما دامت مفيدة ومتوافقة مع سياسات المنصة. يمكن
          طلب مراجعة أو حذف تجربة إذا تضمنت معلومات شخصية، محتوى غير مناسب،
          أو انتهاكًا لحقوق جهة أو فرد.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>حقوق المستخدم</h2>
        <p style={paragraphStyle}>
          للمستخدم الحق في طلب مراجعة البيانات المرتبطة بتجربته، أو طلب حذفها
          أو تصحيحها متى أمكن التحقق من الطلب. يتم التعامل مع الطلبات عبر قنوات
          التواصل المتاحة في الموقع.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>الأمان</h2>
        <p style={paragraphStyle}>
          نستخدم إجراءات معقولة لحماية البيانات من الوصول غير المصرح به أو
          الاستخدام غير المناسب، لكن لا توجد وسيلة إلكترونية مضمونة بالكامل.
          لذلك يجب تجنب إدخال أي معلومات حساسة داخل نص التجربة.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>تحديث السياسة</h2>
        <p style={paragraphStyle}>
          قد يتم تحديث سياسة الخصوصية من وقت لآخر لتناسب تطور المنصة أو
          المتطلبات النظامية. سيتم توضيح تاريخ آخر تحديث أعلى هذه الصفحة.
        </p>
      </section>
    </main>
  );
}
