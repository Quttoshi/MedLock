"""The lab tests MedLock understands, and how to read them.

Only tests in this catalog become results for charts and summaries; anything else a report
mentions is left in the extracted text. Each test has its LOINC code, a canonical unit with
conversions from the units Pakistani labs use, adult reference ranges (by sex where they
differ), limits outside which a value cannot be real (an extraction error), critical limits,
"doctors usually act beyond here" limits for range bars, and guideline bands (e.g. HbA1c
diabetes thresholds).

Ranges are typical adult values for display when a report has no range of its own; a lab's
printed range always takes precedence. They are not for diagnosis.
"""
import re
from dataclasses import dataclass, field
from typing import Callable, Optional, Union

Bound = Optional[float]

PANELS = {
    "blood_count": "Blood count",
    "diabetes": "Diabetes",
    "kidney": "Kidney",
    "electrolytes": "Electrolytes",
    "liver": "Liver",
    "lipids": "Lipids",
    "thyroid": "Thyroid",
    "vitamins": "Vitamins and iron",
    "inflammation": "Inflammation",
}


@dataclass(frozen=True)
class Band:
    """A guideline band shown on charts, e.g. HbA1c 5.7-6.4 = prediabetes."""
    label: str
    low: Bound
    high: Bound
    tone: str  # ok | warn | bad


@dataclass(frozen=True)
class LabTest:
    code: str
    name: str
    panel: str
    unit: str
    loinc: Optional[str]
    aliases: tuple
    # {"all": (low, high)} or {"male": (...), "female": (...)}; None = no bound on that side
    ranges: dict
    plausible: tuple
    # normalized unit -> factor (or function) converting a value to the canonical unit
    conversions: dict = field(default_factory=dict)
    critical: tuple = (None, None)
    action: tuple = (None, None)
    bands: tuple = ()
    # ("abs", amount) or ("rel", fraction): smallest change worth pointing out
    change: tuple = ("rel", 0.2)
    decimals: int = 1
    about: str = ""
    derived: bool = False


Converter = Union[float, Callable[[float], float]]

MASS_PER_DL = {"mg/dl": 1.0}
COUNT_E9 = {  # x10^9/L and its equivalents; per microlitre counts are 1000 times bigger
    "10^9/l": 1.0, "x10^9/l": 1.0, "10e9/l": 1.0, "x10e9/l": 1.0, "10^3/ul": 1.0, "x10^3/ul": 1.0,
    "10*3/ul": 1.0, "10e3/ul": 1.0, "thou/ul": 1.0, "k/ul": 1.0, "/nl": 1.0, "giga/l": 1.0,
    "/ul": 0.001, "/cumm": 0.001, "/cmm": 0.001, "/mm3": 0.001, "cells/ul": 0.001, "cells/cumm": 0.001,
}

_TESTS = [
    # ── Blood count ─────────────────────────────────────────────────────────────
    LabTest("hemoglobin", "Haemoglobin", "blood_count", "g/dL", "718-7",
            ("hemoglobin", "haemoglobin", "hb", "hgb", "hb%"),
            {"male": (13.5, 17.5), "female": (12.0, 15.5)}, (2, 25),
            {"g/dl": 1.0, "gm/dl": 1.0, "g/l": 0.1, "mmol/l": 1.611},
            critical=(7.0, 20.0), action=(10.0, None), change=("abs", 1.0),
            about="Carries oxygen in red blood cells. Low levels mean anaemia."),
    LabTest("rbc", "Red blood cells", "blood_count", "10^12/L", "789-8",
            ("rbc", "red blood cells", "rbc count", "total rbc count", "red cell count", "r b c count"),
            {"male": (4.5, 5.9), "female": (4.1, 5.1)}, (1, 9),
            {"10^12/l": 1.0, "x10^12/l": 1.0, "10e12/l": 1.0, "10^6/ul": 1.0, "x10^6/ul": 1.0,
             "million/ul": 1.0, "mil/ul": 1.0, "m/ul": 1.0, "million/cumm": 1.0, "10^6/mm3": 1.0},
            decimals=2, about="Number of red blood cells."),
    LabTest("wbc", "White blood cells", "blood_count", "10^9/L", "6690-2",
            ("wbc", "white blood cells", "white cell count", "wbc count", "total wbc count", "tlc",
             "total leucocyte count", "total leukocyte count", "leucocyte count", "leukocyte count"),
            {"all": (4.0, 11.0)}, (0.1, 200), COUNT_E9,
            critical=(2.0, 30.0), action=(3.0, 15.0),
            about="Cells that fight infection."),
    LabTest("platelets", "Platelets", "blood_count", "10^9/L", "777-3",
            ("platelets", "platelet count", "plt", "platelet", "platelets count"),
            {"all": (150, 400)}, (1, 2000),
            {**COUNT_E9, "lac/cumm": 100.0, "lakh/cumm": 100.0, "lacs/cumm": 100.0, "lac/ul": 100.0},
            critical=(50, 1000), action=(100, 600), decimals=0,
            about="Help blood clot."),
    LabTest("hematocrit", "Haematocrit (PCV)", "blood_count", "%", "4544-3",
            ("hematocrit", "haematocrit", "hct", "pcv", "packed cell volume"),
            {"male": (41, 53), "female": (36, 46)}, (10, 70), {"%": 1.0, "l/l": 100.0},
            about="Share of the blood made up of red cells."),
    LabTest("mcv", "MCV", "blood_count", "fL", "787-2",
            ("mcv", "mean corpuscular volume", "mean cell volume"),
            {"all": (80, 100)}, (50, 130), {"fl": 1.0}, decimals=0,
            about="Average size of red blood cells; helps tell types of anaemia apart."),
    LabTest("mch", "MCH", "blood_count", "pg", "785-6",
            ("mch", "mean corpuscular hemoglobin", "mean corpuscular haemoglobin", "mean cell hemoglobin"),
            {"all": (27, 33)}, (10, 50), {"pg": 1.0},
            about="Average amount of haemoglobin in each red cell."),
    LabTest("mchc", "MCHC", "blood_count", "g/dL", "786-4",
            ("mchc", "mean corpuscular hemoglobin concentration", "mean corpuscular haemoglobin concentration"),
            {"all": (32, 36)}, (20, 45), {"g/dl": 1.0, "g/l": 0.1, "%": 1.0},
            about="Concentration of haemoglobin in red cells."),
    LabTest("rdw", "RDW", "blood_count", "%", "788-0",
            ("rdw", "rdw-cv", "rdw cv", "red cell distribution width"),
            {"all": (11.5, 14.5)}, (8, 35), {"%": 1.0},
            about="How much red cells vary in size."),
    LabTest("neutrophils", "Neutrophils", "blood_count", "%", "770-8",
            ("neutrophils", "neutrophil", "neutrophils %", "polymorphs", "neut", "segmented neutrophils"),
            {"all": (40, 75)}, (0, 100), {"%": 1.0}, decimals=0,
            about="Main infection-fighting white cells."),
    LabTest("lymphocytes", "Lymphocytes", "blood_count", "%", "736-9",
            ("lymphocytes", "lymphocyte", "lymphocytes %", "lymph"),
            {"all": (20, 45)}, (0, 100), {"%": 1.0}, decimals=0, about="White cells of the immune system."),
    LabTest("monocytes", "Monocytes", "blood_count", "%", "5905-5",
            ("monocytes", "monocyte", "monocytes %", "mono"),
            {"all": (2, 10)}, (0, 100), {"%": 1.0}, decimals=0, about="White cells that clear debris."),
    LabTest("eosinophils", "Eosinophils", "blood_count", "%", "713-8",
            ("eosinophils", "eosinophil", "eosinophils %", "eos"),
            {"all": (1, 6)}, (0, 100), {"%": 1.0}, decimals=0, about="White cells involved in allergies."),
    LabTest("basophils", "Basophils", "blood_count", "%", "706-2",
            ("basophils", "basophil", "basophils %", "baso"),
            {"all": (0, 2)}, (0, 100), {"%": 1.0}, decimals=0, about="Rare white cells."),

    # ── Diabetes ────────────────────────────────────────────────────────────────
    LabTest("hba1c", "HbA1c", "diabetes", "%", "4548-4",
            ("hba1c", "hb a1c", "a1c", "glycated hemoglobin", "glycated haemoglobin", "glycosylated hemoglobin",
             "glycosylated haemoglobin", "hemoglobin a1c", "haemoglobin a1c"),
            {"all": (4.0, 5.6)}, (3, 20),
            {"%": 1.0, "mmol/mol": lambda v: 0.0915 * v + 2.15},
            bands=(Band("Normal", None, 5.7, "ok"), Band("Prediabetes", 5.7, 6.5, "warn"),
                   Band("Diabetes range", 6.5, None, "bad")),
            change=("abs", 0.5),
            about="Average blood sugar over the past 2 to 3 months."),
    LabTest("glucose_fasting", "Fasting glucose", "diabetes", "mg/dL", "1558-6",
            ("fasting glucose", "fasting blood sugar", "fbs", "fasting plasma glucose", "glucose fasting",
             "blood sugar fasting", "bsf", "fasting blood glucose", "fpg", "glucose (fasting)"),
            {"all": (70, 99)}, (10, 1500), {"mg/dl": 1.0, "mmol/l": 18.016},
            critical=(54, 400),
            bands=(Band("Normal", None, 100, "ok"), Band("Prediabetes", 100, 126, "warn"),
                   Band("Diabetes range", 126, None, "bad")),
            decimals=0, about="Blood sugar after not eating for at least 8 hours."),
    LabTest("glucose_random", "Random glucose", "diabetes", "mg/dL", "2345-7",
            ("random glucose", "random blood sugar", "rbs", "glucose random", "blood sugar random", "bsr",
             "random blood glucose", "glucose", "blood glucose", "blood sugar", "plasma glucose", "glucose (random)"),
            {"all": (70, 140)}, (10, 1500), {"mg/dl": 1.0, "mmol/l": 18.016},
            critical=(54, 400), bands=(Band("Diabetes range", 200, None, "bad"),),
            decimals=0, about="Blood sugar at any time of day."),

    # ── Kidney ──────────────────────────────────────────────────────────────────
    LabTest("creatinine", "Creatinine", "kidney", "mg/dL", "2160-0",
            ("creatinine", "creatinine serum", "serum creatinine", "creat"),
            {"male": (0.7, 1.3), "female": (0.5, 1.1)}, (0.1, 25),
            {"mg/dl": 1.0, "umol/l": 1 / 88.42, "mmol/l": 1000 / 88.42},
            action=(None, 2.0), change=("abs", 0.3), decimals=2,
            about="A waste product filtered by the kidneys; used to estimate kidney function."),
    LabTest("urea", "Urea", "kidney", "mg/dL", "3091-6",
            ("urea", "blood urea", "serum urea", "urea serum"),
            {"all": (15, 45)}, (2, 400), {"mg/dl": 1.0, "mmol/l": 6.006}, decimals=0,
            about="A waste product the kidneys remove."),
    LabTest("bun", "Blood urea nitrogen", "kidney", "mg/dL", "3094-0",
            ("bun", "blood urea nitrogen", "urea nitrogen"),
            {"all": (7, 20)}, (1, 200), {"mg/dl": 1.0, "mmol/l": 2.801}, decimals=0,
            about="Nitrogen from urea; another measure of kidney waste removal."),
    LabTest("uric_acid", "Uric acid", "kidney", "mg/dL", "3084-1",
            ("uric acid", "serum uric acid"),
            {"male": (3.4, 7.0), "female": (2.4, 6.0)}, (0.5, 20), {"mg/dl": 1.0, "umol/l": 1 / 59.48},
            about="High levels can cause gout."),
    # 60 and above is not kidney disease on its own (KDIGO), so only below 60 is flagged;
    # the G1/G2 bands still describe values in between.
    LabTest("egfr", "eGFR", "kidney", "mL/min/1.73m²", "98979-8", (),
            {"all": (60, None)}, (1, 200),
            bands=(Band("G1 normal", 90, None, "ok"), Band("G2 mildly reduced", 60, 90, "ok"),
                   Band("G3a", 45, 60, "warn"), Band("G3b", 30, 45, "warn"), Band("G4", 15, 30, "bad"),
                   Band("G5 kidney failure", None, 15, "bad")),
            change=("abs", 10), decimals=0, derived=True,
            about="Estimated kidney filtering rate, calculated from creatinine, age and sex (CKD-EPI 2021)."),

    # ── Electrolytes ────────────────────────────────────────────────────────────
    LabTest("sodium", "Sodium", "electrolytes", "mmol/L", "2951-2",
            ("sodium", "na", "na+", "serum sodium"),
            {"all": (135, 145)}, (100, 180), {"mmol/l": 1.0, "meq/l": 1.0},
            critical=(120, 160), change=("abs", 5), decimals=0, about="Salt balance in the blood."),
    LabTest("potassium", "Potassium", "electrolytes", "mmol/L", "2823-3",
            ("potassium", "k", "k+", "serum potassium"),
            {"all": (3.5, 5.1)}, (1.5, 9), {"mmol/l": 1.0, "meq/l": 1.0},
            critical=(2.5, 6.0), change=("abs", 0.5), about="Important for heart rhythm and muscles."),
    LabTest("chloride", "Chloride", "electrolytes", "mmol/L", "2075-0",
            ("chloride", "cl", "cl-", "serum chloride"),
            {"all": (98, 107)}, (60, 140), {"mmol/l": 1.0, "meq/l": 1.0}, decimals=0,
            about="Works with sodium to balance body fluids."),
    LabTest("calcium", "Calcium", "electrolytes", "mg/dL", "17861-6",
            ("calcium", "total calcium", "serum calcium", "ca", "calcium total"),
            {"all": (8.6, 10.3)}, (4, 16), {"mg/dl": 1.0, "mmol/l": 4.008},
            critical=(6.5, 13.0), about="Needed for bones, nerves and muscles."),
    LabTest("ionized_calcium", "Ionised calcium", "electrolytes", "mmol/L", "1994-3",
            ("ionized calcium", "ionised calcium", "ica", "ca++", "calcium ionized", "calcium ionised"),
            {"all": (1.15, 1.29)}, (0.5, 2.0), {"mmol/l": 1.0, "mg/dl": 1 / 4.008}, decimals=2,
            about="The active form of calcium in the blood."),

    # ── Liver ───────────────────────────────────────────────────────────────────
    LabTest("alt", "ALT (SGPT)", "liver", "U/L", "1742-6",
            ("alt", "sgpt", "alt (sgpt)", "sgpt (alt)", "alt/sgpt", "sgpt/alt", "alanine aminotransferase",
             "alanine transaminase"),
            {"all": (7, 56)}, (1, 10000), {"u/l": 1.0, "iu/l": 1.0}, action=(None, 120), decimals=0,
            about="A liver enzyme; raised levels can mean liver inflammation, e.g. hepatitis."),
    LabTest("ast", "AST (SGOT)", "liver", "U/L", "1920-8",
            ("ast", "sgot", "ast (sgot)", "sgot (ast)", "ast/sgot", "sgot/ast", "aspartate aminotransferase",
             "aspartate transaminase"),
            {"all": (10, 40)}, (1, 10000), {"u/l": 1.0, "iu/l": 1.0}, action=(None, 120), decimals=0,
            about="An enzyme found in the liver and muscles."),
    LabTest("alp", "Alkaline phosphatase", "liver", "U/L", "6768-6",
            ("alp", "alkaline phosphatase", "alk phos", "alk. phosphatase", "alkaline phosphatase (alp)"),
            {"all": (44, 147)}, (5, 3000), {"u/l": 1.0, "iu/l": 1.0}, decimals=0,
            about="An enzyme from the liver and bones."),
    LabTest("ggt", "GGT", "liver", "U/L", "2324-2",
            ("ggt", "gamma gt", "ggtp", "gamma glutamyl transferase", "gamma-glutamyl transferase"),
            {"male": (8, 61), "female": (5, 36)}, (1, 3000), {"u/l": 1.0, "iu/l": 1.0}, decimals=0,
            about="A liver enzyme; raised by bile duct problems or alcohol."),
    LabTest("bilirubin_total", "Total bilirubin", "liver", "mg/dL", "1975-2",
            ("total bilirubin", "bilirubin total", "bilirubin", "serum bilirubin", "s. bilirubin", "t. bilirubin",
             "bilirubin (total)"),
            {"all": (0.1, 1.2)}, (0, 40), {"mg/dl": 1.0, "umol/l": 1 / 17.1}, action=(None, 3.0),
            about="A yellow pigment processed by the liver; high levels cause jaundice."),
    LabTest("bilirubin_direct", "Direct bilirubin", "liver", "mg/dL", "1968-7",
            ("direct bilirubin", "conjugated bilirubin", "bilirubin direct", "bilirubin (direct)", "d. bilirubin"),
            {"all": (0.0, 0.3)}, (0, 30), {"mg/dl": 1.0, "umol/l": 1 / 17.1}, decimals=2,
            about="Bilirubin already processed by the liver."),
    LabTest("total_protein", "Total protein", "liver", "g/dL", "2885-2",
            ("total protein", "total proteins", "serum protein", "protein total"),
            {"all": (6.0, 8.3)}, (2, 15), {"g/dl": 1.0, "g/l": 0.1}, about="All proteins in the blood."),
    LabTest("albumin", "Albumin", "liver", "g/dL", "1751-7",
            ("albumin", "serum albumin"),
            {"all": (3.5, 5.0)}, (1, 7), {"g/dl": 1.0, "g/l": 0.1}, about="The main protein made by the liver."),

    # ── Lipids ──────────────────────────────────────────────────────────────────
    LabTest("cholesterol_total", "Total cholesterol", "lipids", "mg/dL", "2093-3",
            ("cholesterol", "total cholesterol", "serum cholesterol", "cholesterol total", "cholesterol, total"),
            {"all": (None, 200)}, (40, 1000), {"mg/dl": 1.0, "mmol/l": 38.67},
            bands=(Band("Desirable", None, 200, "ok"), Band("Borderline high", 200, 240, "warn"),
                   Band("High", 240, None, "bad")), decimals=0,
            about="All cholesterol in the blood."),
    LabTest("ldl", "LDL cholesterol", "lipids", "mg/dL", "13457-7",
            ("ldl", "ldl cholesterol", "ldl-c", "direct ldl", "ldl cholesterol direct", "low density lipoprotein",
             "ldl-cholesterol"),
            {"all": (None, 100)}, (10, 600), {"mg/dl": 1.0, "mmol/l": 38.67},
            bands=(Band("Optimal", None, 100, "ok"), Band("Near optimal", 100, 130, "ok"),
                   Band("Borderline high", 130, 160, "warn"), Band("High", 160, 190, "bad"),
                   Band("Very high", 190, None, "bad")), decimals=0,
            about="'Bad' cholesterol that can build up in arteries."),
    LabTest("hdl", "HDL cholesterol", "lipids", "mg/dL", "2085-9",
            ("hdl", "hdl cholesterol", "hdl-c", "high density lipoprotein", "hdl-cholesterol"),
            {"male": (40, None), "female": (50, None)}, (5, 200), {"mg/dl": 1.0, "mmol/l": 38.67}, decimals=0,
            about="'Good' cholesterol; higher is better."),
    LabTest("triglycerides", "Triglycerides", "lipids", "mg/dL", "2571-8",
            ("triglycerides", "triglyceride", "tg", "serum triglycerides", "tgs"),
            {"all": (None, 150)}, (10, 5000), {"mg/dl": 1.0, "mmol/l": 88.57},
            bands=(Band("Normal", None, 150, "ok"), Band("Borderline high", 150, 200, "warn"),
                   Band("High", 200, 500, "bad"), Band("Very high", 500, None, "bad")), decimals=0,
            about="A type of fat in the blood."),

    # ── Thyroid ─────────────────────────────────────────────────────────────────
    LabTest("tsh", "TSH", "thyroid", "mIU/L", "3016-3",
            ("tsh", "thyroid stimulating hormone", "s. tsh", "tsh (ultrasensitive)", "ultra sensitive tsh"),
            {"all": (0.4, 4.0)}, (0.001, 200), {"miu/l": 1.0, "uiu/ml": 1.0, "mu/l": 1.0}, decimals=2,
            about="Controls the thyroid; high usually means an underactive thyroid."),
    LabTest("ft4", "Free T4", "thyroid", "ng/dL", "3024-7",
            ("free t4", "ft4", "free thyroxine"),
            {"all": (0.8, 1.8)}, (0.1, 10), {"ng/dl": 1.0, "pmol/l": 1 / 12.87}, decimals=2,
            about="The main thyroid hormone."),
    LabTest("ft3", "Free T3", "thyroid", "pg/mL", "3051-0",
            ("free t3", "ft3", "free triiodothyronine"),
            {"all": (2.3, 4.2)}, (0.5, 30), {"pg/ml": 1.0, "pmol/l": 1 / 1.536},
            about="The active thyroid hormone."),

    # ── Vitamins and iron ───────────────────────────────────────────────────────
    LabTest("vitamin_d", "Vitamin D", "vitamins", "ng/mL", "1989-3",
            ("vitamin d", "vit d", "vitamin d3", "25-oh vitamin d", "25 hydroxy vitamin d", "25(oh)d",
             "25-hydroxy vitamin d", "vitamin d (25-oh)", "vitamin d total"),
            {"all": (30, 100)}, (1, 250), {"ng/ml": 1.0, "nmol/l": 1 / 2.496},
            bands=(Band("Deficient", None, 20, "bad"), Band("Insufficient", 20, 30, "warn"),
                   Band("Sufficient", 30, 100, "ok")), decimals=0,
            about="Needed for strong bones; deficiency is very common in Pakistan."),
    LabTest("vitamin_b12", "Vitamin B12", "vitamins", "pg/mL", "2132-9",
            ("vitamin b12", "b12", "vit b12", "cobalamin", "serum b12"),
            {"all": (200, 900)}, (20, 5000), {"pg/ml": 1.0, "pmol/l": 1.355}, decimals=0,
            about="Needed for nerves and red blood cells."),
    LabTest("ferritin", "Ferritin", "vitamins", "ng/mL", "2276-4",
            ("ferritin", "serum ferritin", "s. ferritin"),
            {"male": (30, 400), "female": (15, 150)}, (1, 10000), {"ng/ml": 1.0, "ug/l": 1.0, "pmol/l": 1 / 2.247},
            decimals=0, about="The body's iron store; low ferritin means iron deficiency."),
    LabTest("iron", "Serum iron", "vitamins", "ug/dL", "2498-4",
            ("iron", "serum iron", "s. iron"),
            {"all": (60, 170)}, (5, 500), {"ug/dl": 1.0, "umol/l": 5.585}, decimals=0,
            about="Iron circulating in the blood."),

    # ── Inflammation ────────────────────────────────────────────────────────────
    LabTest("crp", "CRP", "inflammation", "mg/L", "1988-5",
            ("crp", "c-reactive protein", "c reactive protein", "crp (quantitative)"),
            {"all": (None, 5)}, (0, 500), {"mg/l": 1.0, "mg/dl": 10.0},
            about="Rises with inflammation or infection."),
    LabTest("esr", "ESR", "inflammation", "mm/hr", "4537-7",
            ("esr", "erythrocyte sedimentation rate"),
            {"male": (None, 15), "female": (None, 20)}, (0, 150), {"mm/hr": 1.0, "mm/h": 1.0, "mm/1st hr": 1.0},
            decimals=0, about="A general sign of inflammation."),
]

TESTS = {t.code: t for t in _TESTS}

# ── Matching names ───────────────────────────────────────────────────────────────

_PREFIXES = ("serum ", "s. ", "s ", "plasma ", "blood ", "total ")
_SUFFIXES = (" level", " levels", " count", " (calculated)", " calculated", " serum")


def _clean_name(name: str) -> str:
    name = (name or "").lower().replace("\n", " ")
    name = re.sub(r"[*:•,]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip(" .,-")
    # Older OCR output sometimes glued the previous row's status onto the name
    # ("normal creatinine", "high platelets").
    # ("high density lipoprotein" is a real name, so it is kept.)
    return re.sub(r"^(?:normal|high|low|h|l|status|reference)\s+(?=\S)(?!density)", "", name)


_ALIASES = {}
for _test in _TESTS:
    for _alias in (_test.code.replace("_", " "), _test.name.lower(), *_test.aliases):
        _ALIASES.setdefault(_clean_name(_alias), _test.code)


def match_test(name: str) -> Optional[LabTest]:
    """The catalog test a report's line refers to. Matching is by whole name (with common
    prefixes and suffixes removed), never by substring, so unrelated text is not mistaken
    for a test."""
    clean = _clean_name(name)
    candidates = {clean}
    for prefix in _PREFIXES:
        if clean.startswith(prefix):
            candidates.add(clean[len(prefix):])
    for suffix in _SUFFIXES:
        for c in list(candidates):
            if c.endswith(suffix):
                candidates.add(c[: -len(suffix)])
    # "Haemoglobin (Hb)" -> "haemoglobin" and "hb"
    for c in list(candidates):
        m = re.fullmatch(r"(.+?)\s*\((.+)\)", c)
        if m:
            candidates.update({m.group(1).strip(), m.group(2).strip()})
    for c in candidates:
        code = _ALIASES.get(c)
        if code:
            return TESTS[code]
    return None


# ── Units ────────────────────────────────────────────────────────────────────────

_SUPERSCRIPTS = {"10³": "10^3", "10⁶": "10^6", "10⁹": "10^9", "10¹²": "10^12"}


def normalize_unit(unit: Optional[str]) -> str:
    """Lower case, no spaces, ASCII "u" for micro, "x" for times, and 10^N for powers."""
    u = (unit or "").strip()
    for sup, plain in _SUPERSCRIPTS.items():
        u = u.replace(sup, plain)
    u = u.lower().replace("µ", "u").replace("μ", "u").replace("×", "x").replace(" ", "")
    return u.replace("cu.mm", "cumm").replace("c.mm", "cmm").replace("mm³", "mm3")


def to_canonical(test: LabTest, value: float, unit: Optional[str]) -> tuple[Optional[float], str]:
    """Convert a value to the test's canonical unit. Returns (value, how) where how is
    "exact" (known unit), "assumed" (no unit given) or "unknown" (a unit we cannot convert)."""
    u = normalize_unit(unit)
    if not u or u == normalize_unit(test.unit):
        return value, "exact" if u else "assumed"
    conversion = test.conversions.get(u)
    if conversion is None:
        return None, "unknown"
    return (conversion(value) if callable(conversion) else value * conversion), "exact"


def reference_range(test: LabTest, sex: Optional[str]) -> tuple[Bound, Bound]:
    if "all" in test.ranges:
        return test.ranges["all"]
    if sex in test.ranges:
        return test.ranges[sex]
    # Sex unknown: the widest of the ranges, so nothing is flagged that might be normal.
    lows = [r[0] for r in test.ranges.values() if r[0] is not None]
    highs = [r[1] for r in test.ranges.values() if r[1] is not None]
    return (min(lows) if lows else None, max(highs) if highs else None)


def panel_tests(panel: str) -> list[LabTest]:
    return [t for t in _TESTS if t.panel == panel]
