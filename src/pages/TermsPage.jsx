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

export default function TermsPage() {
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
          سياسة الاستخدام
        </h1>
        <p style={{ ...paragraphStyle, marginTop: "12px", color: "#b8c2c0" }}>
          باستخدامك لمنصة دربك فإنك توافق على هذه السياسة. تهدف المنصة إلى
          مشاركة التجارب الطلابية في التدريب التعاوني بشكل مسؤول ومحترم.
        </p>
      </header>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>طبيعة المحتوى</h2>
        <p style={paragraphStyle}>
          التجارب المنشورة في دربك هي تجارب شخصية يكتبها المستخدمون، وقد تختلف
          باختلاف الفترة، القسم، المشرف، المدينة، وظروف كل طالب. لا تمثل هذه
          التجارب رأي منصة دربك، ولا تمثل بالضرورة رأي أي شركة أو جهة مذكورة.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>حقوق الشركات والجهات</h2>
        <p style={paragraphStyle}>
          جميع أسماء الشركات، الجهات، الشعارات، والعلامات التجارية المذكورة في
          المنصة تعود لأصحابها. ذكر أي جهة لا يعني وجود شراكة، رعاية، اعتماد،
          أو موافقة رسمية من تلك الجهة على المحتوى المنشور.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>التزامات المستخدم</h2>
        <ul style={listStyle}>
          <li>كتابة تجربة صادقة ومحترمة دون تشهير أو إساءة أو اتهامات غير مثبتة.</li>
          <li>عدم نشر أسماء أشخاص، أرقام تواصل، بريد إلكتروني، أو بيانات خاصة.</li>
          <li>عدم نشر أسرار تجارية، وثائق داخلية، معلومات سرية، أو محتوى محمي بحقوق ملكية.</li>
          <li>عدم انتحال صفة جهة، شركة، موظف، طالب آخر، أو أي شخص.</li>
          <li>عدم استخدام المنصة للإعلانات، السبام، أو المحتوى المخالف للأنظمة.</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>مراجعة المحتوى وإزالته</h2>
        <p style={paragraphStyle}>
          يحق لدربك مراجعة، تعديل، إخفاء، أو حذف أي تجربة إذا ظهر أنها مخالفة
          لهذه السياسة، أو تتضمن معلومات خاصة، إساءة، تشهير، انتهاك حقوق، أو
          محتوى غير مناسب. كما يمكن للجهات أو الأفراد طلب مراجعة محتوى يخصهم
          عبر قنوات التواصل المتاحة في الموقع.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>مسؤولية المنصة</h2>
        <p style={paragraphStyle}>
          تسعى دربك لتوفير مساحة مفيدة ومنظمة لمشاركة التجارب، لكنها لا تضمن
          دقة أو اكتمال كل محتوى يكتبه المستخدمون. يتحمل كاتب التجربة مسؤولية
          ما ينشره، وعلى القارئ استخدام التجارب كمرجع مساعد وليس كقرار نهائي.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>حقوق دربك</h2>
        <p style={paragraphStyle}>
          تصميم المنصة، تنسيق المحتوى، الاسم، الهوية، وطريقة عرض التجارب هي
          ملك لمنصة دربك ما لم يذكر خلاف ذلك. لا يسمح بنسخ المنصة أو إعادة
          نشر محتواها بشكل تجاري دون إذن مسبق.
        </p>
      </section>
    </main>
  );
}
