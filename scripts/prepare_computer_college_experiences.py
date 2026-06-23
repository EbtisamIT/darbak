#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re
import sys
from pathlib import Path

import pandas as pd


DEFAULT_INPUT = Path("/Users/ebtisamali/Downloads/تجارب التدريب - كليه الحاسب.xlsx")
DEFAULT_OUTPUT = Path("/tmp/darbak_computer_college_pending_experiences.json")
DEFAULT_CITY = "الرياض"
DEFAULT_MAJOR_CATEGORY = "الحاسب والتقنية"
DEFAULT_MAJOR = "علوم الحاسب"
DEFAULT_HOW_APPLIED = "غير مذكور"
DEFAULT_DURATION = "3 إلى 6 أشهر"
DEFAULT_TRAINING_YEAR = "2019"


COL_ORG = "جهة التدريب :"
COL_DURATION = "مدة التدريب "
COL_JOB = "هل عرضوا عليك (وظيفة، Part time ، إلخ ..)"
COL_DESCRIPTION = "تكلم عن تجربتك مثلًا ( مسماك الوظيفي، القسم اللي تدربت فيه، التيم اللي معاك، خبرتهم، المشاريع اللي اشتغلت عليها إلخ ..)"
COL_REWARD = "في حال كان هناك مكافئة/ راتب الرجاء ذكر المبلغ أو اكتب (لا يوجد)"
COL_RECOMMEND = "من ستنصح بالتدريب لدى الجهة المذكورة أعلاه؟"
COL_NOTES = "ملاحظات : "
COL_ENVIRONMENT = "هل البيئة مختلطه؟"
COL_TIMESTAMP = "Timestamp"


def clean_text(value):
    if pd.isna(value):
        return ""

    text = str(value).strip()
    fixes = {
        "اإليميل": "الإيميل",
        "األيام": "الأيام",
        "األعمال": "الأعمال",
        "اال": "الا",
        "إال": "إلا",
        "مكافئة": "مكافأة",
        "مختلطه": "مختلطة",
        "لايوجد": "لا يوجد",
        "لا بوجد": "لا يوجد",
        "مافيه": "ما فيه",
        "ماكان": "ما كان",
        "مااعطونا": "ما أعطونا",
        "مايقصرون": "ما يقصرون",
        "عالاتصالات": "على الاتصالات",
        "اون لاين": "أونلاين",
        "أون لاين": "أونلاين",
        "جدا": "جدًا",
        "جدأ": "جدًا",
        "متوسطه": "متوسطة",
        "عاليه": "عالية",
        "صلاحيه": "صلاحية",
        "ممكنه": "ممكنة",
        "الشركه": "الشركة",
        "الشرركة": "الشركة",
        "التدريبه": "التدريبية",
        "الخطه": "الخطة",
        "الصدمه": "الصدمة",
        "متحمسه": "متحمسة",
        "ادارية": "إدارية",
        "بحته": "بحتة",
        "قالو": "قالوا",
        "الأشخاص": "الأشخاص",
        "السعودين": "السعوديين",
        "قسك": "قسم",
        "هسقنا": "نسقنا",
        "القوي الامين": "القوي الأمين",
    }

    for old, new in fixes.items():
        text = text.replace(old, new)

    text = re.sub(r"\s+([،.])", r"\1", text)
    text = re.sub(r"([،.])(?=\S)", r"\1 ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" .،\n\t")


def normalize_arabic(value):
    return (
        clean_text(value)
        .lower()
        .replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .replace("ة", "ه")
        .replace("ى", "ي")
        .replace("ؤ", "و")
        .replace("ئ", "ي")
        .replace("ـ", "")
    )


def meaningful(value, minimum_letters=2):
    text = clean_text(value)
    letters = re.findall(r"[A-Za-z\u0600-\u06FF]", text)
    return len(letters) >= minimum_letters and len(set(letters)) > 1


def normalize_duration(value):
    text = normalize_arabic(value)
    if not meaningful(text):
        return DEFAULT_DURATION
    if "شهرين" in text:
        return "شهرين"
    if "٣" in text or "3" in text:
        return "3 أشهر"
    if "اكثر" in text or "أكثر" in clean_text(value):
        return "أكثر من 3 أشهر"
    return DEFAULT_DURATION


def normalize_yes_no(value):
    text = normalize_arabic(value)
    if not text or "لا يوجد" in text or text in {"لا", "nan", "none", "-"}:
        return "no"
    if "نعم" in text or "ايه" in text or "يوجد" in text:
        return "yes"
    if re.search(r"\d", text):
        return "yes"
    return "no"


def normalize_job_offer(value):
    text = normalize_arabic(value)
    if "نعم" in text:
        return "yes"
    return "no"


def normalize_environment(value, description):
    text = normalize_arabic(value)
    desc = normalize_arabic(description)

    if "نعم" in text or "مختلط" in text:
        return "mixed"

    if any(term in desc for term in ["بنات", "متدربه", "مدربه", "موظفات", "خمس بنات"]):
        return "women"

    if any(term in desc for term in ["شباب", "رجال", "موظفين", "دكتور", "هنود"]):
        return "men"

    return "women"


def infer_training_mode(description):
    text = normalize_arabic(description)
    if "اونلاين" in text or "عن بعد" in text or "online" in text:
        return "remote"
    return "onsite"


def infer_stars(description, recommend_value):
    text = normalize_arabic(description)
    recommend = normalize_arabic(recommend_value)

    negative = [
        "لا انصح",
        "لا احد",
        "اختيار اخير",
        "اقل من عادي",
        "ما كان شغلهم احترافي",
        "ما فيه مشاريع",
        "مجرد نجلس",
        "ما اعطونا",
        "ضعيفه",
        "ضعيفة",
        "لم استفد",
    ]
    strong_positive = [
        "ممتازه جدا",
        "ممتازة جدا",
        "ممتازة جدًا",
        "جدا انصح",
        "جدًا انصح",
        "بيئة العمل محفزة",
        "تعلمت اشياء",
        "تعلمت أشياء",
        "وصلنا لمستوى متقدم",
    ]
    positive = [
        "ممتازه",
        "ممتازة",
        "انصح",
        "أنصح",
        "تعلمت",
        "استفدت",
        "خبره",
        "خبرة",
        "متعاونين",
        "يساعدون",
        "مفيده",
        "مفيدة",
    ]

    if any(term in text or term in recommend for term in negative):
        return 2
    if any(term in text for term in strong_positive):
        return 5
    if any(term in text for term in positive):
        return 4
    return 3


def infer_benefit(stars, description):
    text = normalize_arabic(description)
    if any(term in text for term in ["لم استفد", "ما استفدت", "ما تعلمت", "مجرد نجلس", "ما فيه مشاريع"]):
        return "no"
    if any(term in text for term in ["تعلمت", "استفدت", "خبره", "خبرة", "طورنا", "مشروع", "متقدم"]):
        return "yes"
    return "yes" if stars >= 3 else "no"


def infer_recommend(stars, description, recommend_value):
    text = normalize_arabic(description)
    recommend = normalize_arabic(recommend_value)

    if "لا احد" in recommend or any(term in text for term in ["لا انصح", "اختيار اخير", "غير مناسب", "ضعيفه", "ضعيفة"]):
        return "no"
    if recommend and recommend != "nan":
        return "yes"
    if any(term in text for term in ["انصح", "أنصح", "ممتازه", "ممتازة", "تعلمت", "متعاونين"]):
        return "yes"
    return "yes" if stars >= 3 else "no"


def infer_year(value):
    if pd.isna(value):
        return DEFAULT_TRAINING_YEAR
    try:
        year = pd.to_datetime(value).year
        return str(year) if year else DEFAULT_TRAINING_YEAR
    except Exception:
        return DEFAULT_TRAINING_YEAR


def make_title(organization, city):
    if city and city != "غير مذكور":
        return f"تجربتي في {organization} بـ{city}"
    return f"تجربتي في {organization}"


def build_record(row):
    organization = clean_text(row.get(COL_ORG))
    description = clean_text(row.get(COL_DESCRIPTION))
    notes = clean_text(row.get(COL_NOTES))

    if len(description) < 35 and meaningful(notes, minimum_letters=10):
        description = f"{description}. {notes}".strip(" .")

    if not meaningful(organization) or not meaningful(description, minimum_letters=8):
        return None

    stars = infer_stars(description, row.get(COL_RECOMMEND))
    city = DEFAULT_CITY

    return {
        "organizationName": organization,
        "city": city,
        "howApplied": DEFAULT_HOW_APPLIED,
        "duration": normalize_duration(row.get(COL_DURATION)),
        "trainingYear": infer_year(row.get(COL_TIMESTAMP)),
        "wasHired": normalize_job_offer(row.get(COL_JOB)),
        "hadReward": normalize_yes_no(row.get(COL_REWARD)),
        "trainingEnvironment": normalize_environment(row.get(COL_ENVIRONMENT), description),
        "benefitedFromTraining": infer_benefit(stars, description),
        "wouldRecommend": infer_recommend(stars, description, row.get(COL_RECOMMEND)),
        "trainingMode": infer_training_mode(description),
        "starRating": stars,
        "ratings": [],
        "description": description,
        "title": make_title(organization, city),
        "status": "pending",
        "rejectionReason": "",
        "majorCategory": DEFAULT_MAJOR_CATEGORY,
        "major": DEFAULT_MAJOR,
    }


def main():
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT

    df = pd.read_excel(input_path)
    records = []
    skipped = 0

    for _, row in df.iterrows():
        record = build_record(row)
        if record:
            records.append(record)
        else:
            skipped += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "prepared": len(records),
        "skipped": skipped,
        "status": {status: sum(1 for r in records if r["status"] == status) for status in ["pending"]},
        "reward": {value: sum(1 for r in records if r["hadReward"] == value) for value in ["yes", "no"]},
        "jobOffer": {value: sum(1 for r in records if r["wasHired"] == value) for value in ["yes", "no"]},
        "environment": {
            value: sum(1 for r in records if r["trainingEnvironment"] == value)
            for value in ["mixed", "women", "men"]
        },
        "rating": {str(value): sum(1 for r in records if r["starRating"] == value) for value in range(1, 6)},
        "output": str(output_path),
    }

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
