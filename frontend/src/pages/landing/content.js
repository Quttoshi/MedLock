// All the words on the landing page live here, so they are easy to edit
// without touching the layout. Keep claims accurate: AES 256 is applied before
// storage, fingerprints go to the Ethereum Sepolia TEST network, access
// decisions are audit logged (not on the blockchain), and approved access
// lasts a fixed 30 days.
import {
  STANDARD_MAX_MB,
  STANDARD_TYPES_LABEL,
  IMAGING_MAX_MB,
  IMAGING_TYPES_LABEL,
} from "../../constants/upload";

export const NAV_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "Who it is for", href: "#roles" },
  { label: "Questions", href: "#faq" },
];

export const HERO_POINTS = [
  { icon: "lock", text: "Encrypted with AES 256 before storage" },
  { icon: "link", text: "Integrity fingerprints on Ethereum Sepolia testnet" },
  { icon: "scan", text: "Reads printed reports for you" },
];

export const AT_A_GLANCE = [
  { value: "AES 256", label: "encryption applied before a file is stored" },
  { value: "30 days", label: "fixed access window when you approve a doctor" },
  { value: "SHA 256", label: "fingerprint recorded for every report" },
  { value: "3 roles", label: "patients, doctors and medical centers" },
];

export const PROBLEMS = [
  {
    title: "Records are scattered",
    text: "Lab results sit in one hospital system, scans in another and prescriptions in a drawer at home.",
  },
  {
    title: "Tests get repeated",
    text: "A new doctor often cannot see what was done before, so the same tests are ordered again.",
  },
  {
    title: "You rarely control who sees what",
    text: "Once a report is shared, it is hard to know who has it, or to take access back.",
  },
];

export const STEPS = [
  {
    title: "Add a report",
    text: "Upload a PDF or a photo of a lab report, prescription or discharge summary. Hospitals can also upload straight to your record, and you approve it first.",
  },
  {
    title: "It is protected and fingerprinted",
    text: "The file is encrypted before it is stored. A fingerprint of it is recorded on the Ethereum Sepolia testnet, and printed text is read so you can check it against the original.",
  },
  {
    title: "You decide who sees it",
    text: "A verified doctor sends an access request. You approve or deny it. Approval lasts 30 days, and you can take it back at any time.",
  },
];

export const FEATURES = [
  {
    icon: "lock",
    title: "Encrypted before storage",
    text: "Every file is encrypted with AES 256 before it is stored, so it is never kept as a plain file.",
  },
  {
    icon: "userCheck",
    title: "Access only with your approval",
    text: "Doctors have to ask. You approve or deny each request, and revoke it whenever you like.",
  },
  {
    icon: "shieldCheck",
    title: "Integrity you can check",
    text: "Verify a record at any time. MedLock compares the file with the fingerprint recorded when it was uploaded and tells you if it no longer matches.",
  },
  {
    icon: "scan",
    title: "Printed text, read for you",
    text: "Values from printed and typed reports are extracted so you can scan them quickly. Always check them against the original file. Handwriting is not read.",
  },
  {
    icon: "layers",
    title: "Scans, not just PDFs",
    text: "CT and MRI studies can be uploaded as DICOM files and scrolled through slice by slice in the browser.",
  },
  {
    icon: "badgeCheck",
    title: "Verified doctors and centers",
    text: "Medical centers are approved by an admin, and doctors are verified against their license before they work with patient records.",
  },
];

export const ROLES = [
  {
    key: "patient",
    label: "Patients",
    title: "One place for your whole history",
    text: "Keep reports from every hospital together and share them only when you choose to.",
    points: [
      "A timeline of every report and scan",
      "Approve or deny each access request",
      "Check that a file has not changed",
    ],
    cta: "Create a patient account",
    to: "/register/patient",
  },
  {
    key: "doctor",
    label: "Doctors",
    title: "The full picture, with consent",
    text: "Ask a patient for access and read their approved records in one place.",
    points: [
      "Send access requests to patients",
      "Read approved records, including scans",
      "Verified by license or through your hospital",
    ],
    cta: "Register as a doctor",
    to: "/register/doctor",
  },
  {
    key: "center",
    label: "Medical centers",
    title: "Upload once, share safely",
    text: "Send results straight to the patient's record and manage the doctors affiliated with your center.",
    points: [
      "Upload reports and imaging for patients",
      "Patients approve before it joins their record",
      "Verify the doctors who work with you",
    ],
    cta: "Register a medical center",
    to: "/register/medical_center",
  },
];

export const SECURITY_CARDS = [
  {
    title: "Encrypted before it is stored",
    text: "Files are locked with AES 256 on the server before they are saved. Only people you approve can open them through MedLock.",
  },
  {
    title: "Fingerprinted on a public network",
    text: "A SHA 256 fingerprint of each report is recorded on the Ethereum Sepolia testnet. The record itself is never put on the blockchain.",
  },
  {
    title: "Access decisions are logged",
    text: "Requests, approvals, denials and revocations are written to an audit log. Admins can see activity, but never the content of a record.",
  },
];

export const SECURITY_SAMPLE = [
  ["record", "CBC Blood Panel"],
  ["sha256", "7a3f09e2…3a2fc91e"],
  ["chain", "Ethereum Sepolia testnet"],
  ["status", "match, intact"],
];

export const HONEST_LIMITS = [
  "Sepolia is a test network, not the main Ethereum network.",
  "MedLock is a university project. It has not been independently audited or certified.",
  "It does not give medical advice, diagnosis or treatment. Always talk to your doctor.",
];

export const FAQS = [
  {
    q: "Can MedLock staff read my records?",
    a: "Files are encrypted with AES 256 before they are stored, and only people you approve can open them through MedLock. Admins manage accounts and approvals, and their screens never show record content.",
  },
  {
    q: "What does the blockchain actually store?",
    a: "Only a fingerprint (a SHA 256 hash) of each report, never the report itself. It lets MedLock show whether a file has changed since it was uploaded. The network used is Ethereum Sepolia, a test network.",
  },
  {
    q: "How long does a doctor's access last?",
    a: "When you approve a request, the doctor gets access for 30 days. After that it ends by itself. You can also take it back earlier, and the doctor can no longer open your records.",
  },
  {
    q: "Can I add old paper reports?",
    a: `Yes, as a photo or a scan. ${STANDARD_TYPES_LABEL} files are accepted up to ${STANDARD_MAX_MB}MB. MedLock reads printed and typed text, so check the extracted values against the original. Handwriting is not read.`,
  },
  {
    q: "Can I upload CT or MRI scans?",
    a: `Yes. Upload a ${IMAGING_TYPES_LABEL}, up to ${IMAGING_MAX_MB}MB, and you can scroll through the slices in your browser.`,
  },
  {
    q: "Does MedLock diagnose anything?",
    a: "No. MedLock stores and shares your records. The extracted values are there to help you read a report, not to interpret it. Your doctor does that.",
  },
  {
    q: "How are doctors and medical centers verified?",
    a: "Medical centers are approved by an admin. A doctor is verified by their medical center, or by an admin who checks their license on the PMDC register. A doctor has to be verified before working with patient records.",
  },
  {
    q: "Who built MedLock?",
    a: "MedLock is a final year project at FAST NUCES Islamabad, built by three students and supervised by a faculty member.",
  },
];

export const PROJECT = {
  university: "FAST NUCES Islamabad",
  year: "2026",
  team: ["Shehbaz Karim", "Shabo Kiran", "Abyaz Israr"],
  supervisor: "Mr. Muhammad Almas Khan",
  repo: "https://github.com/Quttoshi/MedLock",
};
