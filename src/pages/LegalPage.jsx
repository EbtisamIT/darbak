import React from "react";

const policyCardStyle = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  padding: "18px",
  minHeight: "100%",
};

const sectionStyle = {
  borderTop: "1px solid rgba(255,255,255,0.08)",
  paddingTop: "14px",
  marginTop: "14px",
};

const headingStyle = {
  color: "#7ddbcd",
  margin: "0 0 10px",
  fontSize: "19px",
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

const Badge = () => (
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
);

export default function LegalPage() {
  return (
    <main
      style={{
        direction: "rtl",
        textAlign: "right",
        width: "100%",
        maxWidth: "1120px",
        margin: "0 auto",
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      <header style={{ marginBottom: "24px", textAlign: "center" }}>
        <Badge />
        <h1 style={{ color: "#fff", margin: 0, fontSize: "34px" }}>
          السياسات القانونية لدربك
        </h1>
        <p
          style={{
            ...paragraphStyle,
            maxWidth: "760px",
            margin: "12px auto 0",
            color: "#b8c2c0",
          }}
        >
          توضح هذه الصفحة سياسة الاستخدام وسياسة الخصوصية لحماية حقوق منصة
          دربك، وحقوق الطلاب، وحقوق الشركات والجهات المذكورة في التجارب.
        </p>
      </header>

      <div className="legal-grid">
        <article id="terms" style={policyCardStyle}>
          <h2 style={{ color: "#fff", margin: 0, fontSize: "28px" }}>
            سياسة الاستخدام
          </h2>
          <p style={{ ...paragraphStyle, marginTop: "10px" }}>
            باستخدامك لمنصة دربك فإنك توافق على هذه السياسة. تهدف المنصة إلى
            مشاركة التجارب الطلابية في التدريب التعاوني بشكل مسؤول ومحترم.
          </p>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>طبيعة المحتوى</h3>
            <p style={paragraphStyle}>
              التجارب المنشورة في دربك هي تجارب شخصية يكتبها المستخدمون، وقد
              تختلف باختلاف الفترة، القسم، المشرف، المدينة، وظروف كل طالب. لا
              تمثل هذه التجارب رأي منصة دربك، ولا تمثل بالضرورة رأي أي شركة أو
              جهة مذكورة.
            </p>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>حقوق الشركات والجهات</h3>
            <p style={paragraphStyle}>
              جميع أسماء الشركات، الجهات، الشعارات، والعلامات التجارية المذكورة
              في المنصة تعود لأصحابها. ذكر أي جهة لا يعني وجود شراكة، رعاية،
              اعتماد، أو موافقة رسمية من تلك الجهة على المحتوى المنشور.
            </p>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>التزامات المستخدم</h3>
            <ul style={listStyle}>
              <li>كتابة تجربة صادقة ومحترمة دون تشهير أو إساءة أو اتهامات غير مثبتة.</li>
              <li>عدم نشر أسماء أشخاص، أرقام تواصل، بريد إلكتروني، أو بيانات خاصة.</li>
              <li>عدم نشر أسرار تجارية، وثائق داخلية، معلومات سرية، أو محتوى محمي بحقوق ملكية.</li>
              <li>عدم انتحال صفة جهة، شركة، موظف، طالب آخر، أو أي شخص.</li>
              <li>عدم استخدام المنصة للإعلانات، السبام، أو المحتوى المخالف للأنظمة.</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>مراجعة المحتوى وإزالته</h3>
            <p style={paragraphStyle}>
              يحق لدربك مراجعة، تعديل، إخفاء، أو حذف أي تجربة إذا ظهر أنها
              مخالفة لهذه السياسة، أو تتضمن معلومات خاصة، إساءة، تشهير، انتهاك
              حقوق، أو محتوى غير مناسب. كما يمكن للجهات أو الأفراد طلب مراجعة
              محتوى يخصهم عبر قنوات التواصل المتاحة في الموقع.
            </p>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>مسؤولية المنصة</h3>
            <p style={paragraphStyle}>
              تسعى دربك لتوفير مساحة مفيدة ومنظمة لمشاركة التجارب، لكنها لا
              تضمن دقة أو اكتمال كل محتوى يكتبه المستخدمون. يتحمل كاتب التجربة
              مسؤولية ما ينشره، وعلى القارئ استخدام التجارب كمرجع مساعد وليس
              كقرار نهائي.
            </p>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>حقوق دربك</h3>
            <p style={paragraphStyle}>
              تصميم المنصة، تنسيق المحتوى، الاسم، الهوية، وطريقة عرض التجارب
              هي ملك لمنصة دربك ما لم يذكر خلاف ذلك. لا يسمح بنسخ المنصة أو
              إعادة نشر محتواها بشكل تجاري دون إذن مسبق.
            </p>
          </section>
        </article>

        <article id="privacy" style={policyCardStyle}>
          <h2 style={{ color: "#fff", margin: 0, fontSize: "28px" }}>
            سياسة الخصوصية
          </h2>
          <p style={{ ...paragraphStyle, marginTop: "10px" }}>
            توضح هذه السياسة كيف تتعامل منصة دربك مع البيانات عند استخدام
            الموقع أو إضافة تجربة تدريبية.
          </p>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>البيانات التي نجمعها</h3>
            <ul style={listStyle}>
              <li>بيانات التجربة التي يدخلها المستخدم، مثل اسم الجهة، المدينة، التخصص، مدة التدريب، طريقة التقديم، التقييم، ووصف التجربة.</li>
              <li>بيانات تقنية محدودة قد تشمل نوع المتصفح، الجهاز، الصفحات التي تمت زيارتها، وأوقات الاستخدام لأغراض التحسين والحماية.</li>
              <li>لا تطلب دربك إنشاء حساب، ولا تطلب الاسم الحقيقي للطالب عند إضافة التجربة.</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>أغراض استخدام البيانات</h3>
            <ul style={listStyle}>
              <li>عرض التجارب الطلابية ومساعدة الزوار على البحث والمقارنة.</li>
              <li>تحسين تجربة المستخدم، ترتيب المحتوى، واكتشاف المشاكل التقنية.</li>
              <li>حماية المنصة من الإساءة، السبام، أو المحتوى المخالف.</li>
              <li>الاستجابة لطلبات المراجعة أو الحذف عند الحاجة.</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>إخفاء الهوية وحماية الخصوصية</h3>
            <p style={paragraphStyle}>
              صممت دربك لتكون مشاركة التجارب بدون إظهار هوية الطالب. لذلك ننصح
              المستخدم بعدم كتابة أي معلومات قد تكشف هويته أو هوية أشخاص آخرين،
              مثل الأسماء الشخصية، أرقام التواصل، البريد الإلكتروني، الروابط
              الخاصة، أو تفاصيل داخلية حساسة.
            </p>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>مشاركة البيانات مع أطراف أخرى</h3>
            <p style={paragraphStyle}>
              لا تبيع دربك بيانات المستخدمين. قد تستخدم المنصة خدمات تشغيل
              وتحليل واستضافة مثل خدمات الاستضافة وقاعدة البيانات والتحليلات،
              وذلك لتشغيل الموقع وقياس الأداء وتحسينه.
            </p>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>الاحتفاظ والحذف</h3>
            <p style={paragraphStyle}>
              قد تبقى التجارب منشورة ما دامت مفيدة ومتوافقة مع سياسات المنصة.
              يمكن طلب مراجعة أو حذف تجربة إذا تضمنت معلومات شخصية، محتوى غير
              مناسب، أو انتهاكًا لحقوق جهة أو فرد.
            </p>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>حقوق المستخدم</h3>
            <p style={paragraphStyle}>
              للمستخدم الحق في طلب مراجعة البيانات المرتبطة بتجربته، أو طلب
              حذفها أو تصحيحها متى أمكن التحقق من الطلب. يتم التعامل مع الطلبات
              عبر قنوات التواصل المتاحة في الموقع.
            </p>
          </section>

          <section style={sectionStyle}>
            <h3 style={headingStyle}>الأمان وتحديث السياسة</h3>
            <p style={paragraphStyle}>
              نستخدم إجراءات معقولة لحماية البيانات، لكن لا توجد وسيلة
              إلكترونية مضمونة بالكامل. قد يتم تحديث سياسة الخصوصية من وقت
              لآخر، وسيتم توضيح تاريخ آخر تحديث أعلى هذه الصفحة.
            </p>
          </section>
        </article>
      </div>

      <style>{`
        .legal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          align-items: start;
        }

        @media (max-width: 860px) {
          .legal-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .legal-grid article {
            padding: 14px !important;
          }

          .legal-grid h2 {
            font-size: 24px !important;
          }

          .legal-grid h3 {
            font-size: 18px !important;
          }
        }
      `}</style>
    </main>
  );
}
