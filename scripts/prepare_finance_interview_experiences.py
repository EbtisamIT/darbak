#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re
import sys
from pathlib import Path

import pandas as pd


DEFAULT_INPUT = Path("/Users/ebtisamali/Downloads/تجارب التدريب التعاوني لطالبات المالية.xlsx")
DEFAULT_OUTPUT = Path("/tmp/darbak_finance_interview_experiences.json")
DEFAULT_CITY = "الرياض"
DEFAULT_MAJOR_CATEGORY = "المالية والإدارية"
DEFAULT_MAJOR = "المالية"
DEFAULT_DURATION = "3 إلى 6 أشهر"

COL_ORGANIZATION = "اسم جهة التدريب:"
COL_DURATION = "مدة التدريب:"
COL_DESCRIPTION = "شاركينا تجربتك مثلًا: ( المسمى الوظيفي، مجال العمل وطبيعته، القسم اللي تدربت فيه، الفريق اللي اشتغلت معاه، خبراتهم، المشاريع اللي اشتغلت عليها إلخ ..)"
COL_INTERVIEW = "ماهي الأسئلة اللي تم توجيهها لك أثناء المقابلة الشخصية عن سيرتك الذاتية، أو بشكل عام؟"
COL_OFFER = "هل عرضوا عليك وظيفة أو عمل جزئي، الخ؟"
COL_ENVIRONMENT = "هل البيئة مختلطة؟"
COL_RECOMMEND = "هل تنصحين بالتدريب لدى الجهة."
COL_NOTES = "أي ملاحظات  إضافية"
COL_REWARD = "في حال كان هناك مكافئة/ راتب الرجاء ذكر المبلغ والنوع، أو(لا يوجد)"
COL_APPLIED = "طريقة التقديم على الجهة: (لنكد ان، ايميل، موقع الجهة أو غير ذلك)"
COL_TIMESTAMP = "Timestamp"


def clean_text(value):
    if pd.isna(value):
        return ""

    text = str(value).replace("\u200f", "").replace("\u200e", "").strip()
    fixes = {
        "االتصاالت": "الاتصالات",
        "االتصالات": "الاتصالات",
        "اإليميل": "الإيميل",
        "األصول": "الأصول",
        "األعمال": "الأعمال",
        "األرباح": "الأرباح",
        "األكاديمية": "الأكاديمية",
        "األسهم": "الأسهم",
        "االستثمار": "الاستثمار",
        "االستثماريه": "الاستثمارية",
        "ابحاث": "أبحاث",
        "اصول": "أصول",
        "الأصول": "الأصول",
        "استثماريه": "استثمارية",
        "ماليه": "مالية",
        "الماليه": "المالية",
        "الاساسي": "الأساسي",
        "ادارة": "إدارة",
        "اداره": "إدارة",
        "انشاء": "إنشاء",
        "الانقليزي": "الإنجليزي",
        "انترڤيو": "مقابلة",
        "اسئله": "أسئلة",
        "اسئلة": "أسئلة",
        "اسهم": "أسهم",
        "الصنادق": "الصناديق",
        "الصناديق الاستثماريه": "الصناديق الاستثمارية",
        "الجامعه": "الجامعة",
        "المقابله": "المقابلة",
        "بروجكت": "مشروع",
        "البروجكت": "المشروع",
        "بروجكتس": "مشاريع",
        "تيم": "فريق",
        "تيمز": "فرق",
        "فريقز": "فرق",
        "فرق مختلفين": "فرق مختلفة",
        "تدربين": "تتدرب",
        "تشتغلين": "تعمل",
        "تكلمي": "تحدث",
        "سألوني": "تم السؤال",
        "سألني": "تم السؤال",
        "سيرتك": "السيرة الذاتية",
        "شرحله": "شرح",
        "عشان": "حتى",
        "كانو": "كانوا",
        "مافي": "ما في",
        "ماحطوني": "ما وضعوني",
        "السستم": "النظام",
        "لايوجد": "لا يوجد",
        "لابوجد": "لا يوجد",
        "مكافئة": "مكافأة",
        "ممتازه": "ممتازة",
        "مميزه": "مميزة",
        "مريحه": "مريحة",
        "متنوعه": "متنوعة",
        "مهمه": "مهمة",
        "المشروعس": "المشاريع",
        "متتدرب": "متدرب",
        "المتتدرب": "المتدرب",
        "اشياء": "أشياء",
        "باشياء": "بأشياء",
        "يبدا": "يبدأ",
        "اهم": "أهم",
        "احيانا": "أحيانًا",
        "باذن": "بإذن",
        "فتره": "فترة",
        "صعبه": "صعبة",
        "نوعا": "نوعًا",
        "فايده": "فائدة",
        "الصراحه": "الصراحة",
        "مااذكر": "ما أذكر",
        "مايدققون": "لا يدققون",
        "لانهم": "لأنهم",
        "يبون": "يريدون",
        "اي احد": "أي أحد",
        "ياخذ": "يستغرق",
        "اسبوع": "أسبوع",
        "اتمنى": "أتمنى",
        "اعرف": "أعرف",
        "اعصاب": "أعصاب",
        "الامل": "الأمل",
        "امركم": "أمركم",
        "حلوو": "جميل",
        "يجننون": "متعاون جدًا",
        "عسل": "متعاونون",
        "آلالي": "الآلي",
        "breifly": "briefly",
        "نعم يوجد": "يوجد",
        "يوجد /": "يوجد",
        "جدا": "جدًا",
    }

    for old, new in fixes.items():
        text = text.replace(old, new)

    text = re.sub(r"(?<!\S)لين(?!\S)", "إلى أن", text)
    text = re.sub(r"عس+ل", "متعاونون", text)
    text = re.sub(r"\bاو\b", "أو", text)
    text = re.sub(r"^[\s.،;؛\-–_]+|[\s.،;؛\-–_]+$", "", text)
    text = re.sub(r"\s+([،.؟])", r"\1", text)
    text = re.sub(r"([،.؟])(?=\S)", r"\1 ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" .،\n\t")


def normalize_arabic(value):
    return (
        clean_text(value)
        .lower()
        .replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .replace("ى", "ي")
        .replace("ة", "ه")
        .replace("ؤ", "و")
        .replace("ئ", "ي")
        .replace("ـ", "")
    )


def meaningful(value, minimum=2):
    text = clean_text(value)
    letters = re.findall(r"[A-Za-z\u0600-\u06FF]", text)
    normalized = normalize_arabic(text)
    return (
        len(letters) >= minimum
        and normalized not in {"لا", "لا يوجد", "لايوجد", "nan", "none", "محايد"}
    )


def normalize_organization(value):
    text = clean_text(value)
    replacements = {
        "HSBC – بنك": "HSBC",
        "McKinsey and Co": "McKinsey & Company",
        "الاهلي كابيتال": "الأهلي كابيتال",
        "جدوى للأستثمار": "جدوى للاستثمار",
        "بنك العربي": "البنك العربي",
        "بنك ساب ( بنك الشركات)": "بنك ساب",
        "فالكم للخدمات المالية (يقين حاليًا)": "فالكم للخدمات المالية | يقين",
        "فالكم للخدمات المالية": "فالكم للخدمات المالية",
    }
    return replacements.get(text, text)


def normalize_duration(value):
    text = clean_text(value)
    normalized = normalize_arabic(text)
    if not meaningful(text):
        return DEFAULT_DURATION
    if any(term in normalized for term in ["شهرين", "شهرين"]):
        return "شهرين"
    if "٧" in text or "7" in text or "سبع" in normalized:
        return "7 أشهر"
    if "٦" in text or "6" in text or "سته" in normalized or "ست" in normalized:
        return "6 أشهر"
    if "٥" in text or "5" in text or "خمس" in normalized:
        return "5 أشهر"
    if "٤" in text or "4" in text or "اربع" in normalized:
        return "4 أشهر"
    if "٣" in text or "3" in text or "ثلاث" in normalized:
        return "3 أشهر"
    if "تمديد" in normalized:
        return "مدة التدريب قابلة للتمديد حسب الجهة"
    if "الجامعه" in normalized or "الجامعة" in text:
        return "حسب مدة التدريب الجامعية"
    return text


def normalize_yes_no(value, default="no"):
    text = normalize_arabic(value)
    if not text:
        return default
    if any(term in text for term in ["نعم", "ايه", "يوجد", "عرضوا"]):
        return "yes"
    if any(term in text for term in ["لا", "ما", "لم", "لا يوجد", "محايد", "-"]):
        return "no"
    return default


def normalize_reward(value):
    raw = clean_text(value)
    text = normalize_arabic(raw)
    if not raw or text in {"-", ".", "ء", "،", "لا", "لا يوجد", "لايوجد"}:
        return "no", ""

    digit_match = re.search(r"[\d٠-٩]+(?:\s*[,.]\s*[\d٠-٩]+)?", raw)
    if digit_match:
        amount = digit_match.group(0)
        return "yes", f"{amount} ريال"

    if any(term in text for term in ["سري", "سريه", "مكافاه", "راتب", "يوجد"]):
        return "yes", "يوجد مكافأة"

    return "no", ""


def normalize_environment(value):
    text = normalize_arabic(value)
    if "نعم" in text or "مختلط" in text or "محايد" in text:
        return "mixed"
    if "لا" in text:
        return "women"
    return "mixed"


def normalize_recommend(value):
    text = normalize_arabic(value)
    if "لا" in text:
        return "no"
    if "نعم" in text:
        return "yes"
    return ""


def infer_rating(description, recommend_value):
    text = normalize_arabic(description)
    recommend = normalize_recommend(recommend_value)
    negative_terms = [
        "لا انصح",
        "لم استفد",
        "لا استفدت",
        "ليس له علاقه",
        "ليس له علاقة",
        "روتيني",
        "قليل",
        "ما كان له علاقه",
        "صعوبه",
    ]
    strong_terms = [
        "ممتازه جدا",
        "ممتازة جدا",
        "تعلمت",
        "استفدت",
        "فرصه ممتازه",
        "بيئه محفزه",
        "بيئة محفزة",
        "متعاون",
    ]
    if any(term in text for term in negative_terms) or recommend == "no":
        return 2
    if any(term in text for term in strong_terms):
        return 5
    if recommend == "yes":
        return 4
    return 3


def infer_benefit(description, rating):
    text = normalize_arabic(description)
    if any(term in text for term in ["لم استفد", "لا استفدت", "ما استفدت", "ليس له علاقه", "قليل"]):
        return "no"
    if any(term in text for term in ["تعلمت", "استفدت", "خبره", "خبرة", "مشروع", "تحليل", "تقييم"]):
        return "yes"
    return "yes" if rating >= 3 else "no"


def normalize_application(value):
    text = clean_text(value)
    normalized = normalize_arabic(text)
    if not meaningful(text):
        return "غير مذكور"
    replacements = {
        "لنكد ان": "LinkedIn",
        "لينكد ان": "LinkedIn",
        "لينكدإن": "LinkedIn",
        "ايميل": "البريد الإلكتروني",
        "الإيميل": "البريد الإلكتروني",
        "الجامعه": "ترشيح من الجامعة",
        "الجامعة رشحتني لهم": "ترشيح من الجامعة",
        "موقع": "موقع الجهة",
    }
    for key, label in replacements.items():
        if normalize_arabic(key) in normalized:
            return label
    return text


def normalize_description(value, notes):
    description = clean_text(value)
    notes_text = clean_text(notes)

    description = re.sub(r"^[\s\-–•]+", "", description)
    description = re.sub(r"\s*[-–]\s*", "، ", description)
    description = re.sub(r"\s+", " ", description).strip(" .،")

    if meaningful(notes_text) and normalize_arabic(notes_text) not in normalize_arabic(description):
        description = f"{description} {notes_text}".strip()

    if not meaningful(description, minimum=8):
        description = "تمت مشاركة تجربة تدريب في مجال المالية دون تفاصيل كثيرة، ويمكن مراجعة بيانات الجهة وطريقة التقديم وأسئلة المقابلة المرتبطة بها."

    return description


def normalize_questions(value):
    text = clean_text(value)
    normalized = normalize_arabic(text)
    if not meaningful(text) or any(
        term in normalized
        for term in ["لا يوجد", "لا توجد", "لم يكن هناك مقابله", "لم تكن هناك مقابله", "ما كان فيه مقابله", "بدون مقابله", "لا مقابله"]
    ):
        return []

    parts = re.split(r"\n+|\s[-–]\s|(?<=[\u0600-\u06FF])-\s+|[؛;]+", text)
    questions = []
    seen = set()

    for part in parts:
        question = clean_text(part)
        question = re.sub(r"^[\d٠-٩]+[.)-]\s*", "", question).strip(" .،")
        if len(question) < 4:
            continue
        key = normalize_arabic(question)
        if key in seen:
            continue
        seen.add(key)
        questions.append(question)

    return questions[:12]


def training_year(value):
    if pd.isna(value):
        return "2022"
    try:
        return str(pd.to_datetime(value).year)
    except Exception:
        return "2022"


def build_records(input_path):
    df = pd.read_excel(input_path, header=1)
    df = df.dropna(how="all")
    records = []

    for _, row in df.iterrows():
        organization = normalize_organization(row.get(COL_ORGANIZATION, ""))
        if not organization:
            continue

        description = normalize_description(
            row.get(COL_DESCRIPTION, ""),
            row.get(COL_NOTES, ""),
        )
        rating = infer_rating(description, row.get(COL_RECOMMEND, ""))
        had_reward, reward_amount = normalize_reward(row.get(COL_REWARD, ""))

        records.append(
            {
                "organizationName": organization,
                "city": DEFAULT_CITY,
                "howApplied": normalize_application(row.get(COL_APPLIED, "")),
                "duration": normalize_duration(row.get(COL_DURATION, "")),
                "trainingYear": training_year(row.get(COL_TIMESTAMP, "")),
                "wasHired": normalize_yes_no(row.get(COL_OFFER, ""), default="no"),
                "hadReward": had_reward,
                "rewardAmount": reward_amount,
                "trainingEnvironment": normalize_environment(row.get(COL_ENVIRONMENT, "")),
                "benefitedFromTraining": infer_benefit(description, rating),
                "wouldRecommend": normalize_recommend(row.get(COL_RECOMMEND, "")),
                "trainingMode": "onsite",
                "starRating": rating,
                "ratings": [],
                "interviewQuestions": normalize_questions(row.get(COL_INTERVIEW, "")),
                "description": description,
                "sourceType": "public_summary",
                "status": "pending",
                "rejectionReason": "",
                "majorCategory": DEFAULT_MAJOR_CATEGORY,
                "major": DEFAULT_MAJOR,
            }
        )

    return records


def main():
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT
    records = build_records(input_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    with_questions = sum(1 for record in records if record["interviewQuestions"])
    print(f"Prepared records: {len(records)}")
    print(f"Records with interview questions: {with_questions}")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()
