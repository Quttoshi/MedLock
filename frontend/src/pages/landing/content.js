// All the words on the landing page live here, so they are easy to edit
// without touching the layout. Keep claims accurate: AES 256 is applied on the
// server before storage, fingerprints go to the Ethereum Sepolia TEST network,
// access decisions are audit logged (not on the blockchain), and approved
// access lasts a fixed 30 days. Do not claim HIPAA or any certification.

export const NAV_LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Who We Serve", href: "#roles" },
  { label: "Security", href: "#security" },
  { label: "How It Works", href: "#how" },
  { label: "About Us", href: "#about" },
];

export const HERO = {
  title: "Medical records that stay in the patient's hands",
  text: "MedLock keeps every report, scan and prescription in one encrypted record. Patients decide which doctors can see it, and every access decision is written to an audit log. Because your health history should never start from zero.",
  primary: "Create your account",
  secondary: "See how MedLock works",
};

export const CALLOUT = {
  title: "Doctors ask. Patients approve. Every access stays on record.",
  link: "Explore our security model",
};

export const PLATFORM = {
  eyebrow: "Patient records and more with",
  text: "One secure platform that brings together encrypted record storage, patient approved sharing, report reading for printed text and medical imaging, for patients, doctors and medical centers.",
  cta: "Learn more about MedLock",
  cards: [
    {
      image: "/images/landing/diagnostic-lab.jpg",
      alt: "A technician working in a diagnostic laboratory",
      position: "center",
      title: "Results delivered, not printed",
      text: "Labs and hospitals upload reports and scans straight into the patient's record, each one fingerprinted for later proof.",
      link: "Explore for medical centers",
      role: "center",
    },
    {
      image: "/images/landing/doctor-portrait.jpg",
      alt: "A smiling doctor in a white coat",
      position: "center 25%",
      title: "The full picture before the visit",
      text: "With the patient's approval, doctors review reports from every lab and clinic together, and check that each one is unchanged.",
      link: "Explore for doctors",
      role: "doctor",
    },
  ],
};

// "to" is where the button in each tab goes. Every route already exists.
export const ROLES = {
  eyebrow: "Who we serve",
  title: "Built for everyone who touches a medical record",
  tabs: [
    {
      id: "patient",
      label: "Patients",
      title: "Your records, your decision",
      body: "Keep every report in one place, carry your history to any doctor or city, and approve access before your appointment.",
      cta: "Create a patient account",
      to: "/register/patient",
      points: [
        { head: "Continuity of care", text: "Your full history moves with you when you change doctors or cities." },
        { head: "Pre appointment access", text: "Approve a request in advance so the visit is spent on decisions." },
        { head: "Protection against lost reports", text: "An encrypted copy stays safe even if the paper is lost." },
      ],
    },
    {
      id: "doctor",
      label: "Doctors",
      title: "The full picture before the patient walks in",
      body: "With the patient's approval, review reports from every lab and clinic together and check that each one is unchanged.",
      cta: "Create a doctor account",
      to: "/register/doctor",
      points: [
        { head: "Pre visit review", text: "Read reports before the appointment and save consultation time." },
        { head: "Avoid repeated tests", text: "See recent tests and spare the patient extra cost and delay." },
        { head: "Trust in the data", text: "An integrity check confirms each report matches its original upload." },
      ],
    },
    {
      id: "center",
      label: "Medical centers",
      title: "Deliver results straight into the record",
      body: "Hospitals, clinics and labs upload reports and scans directly to the patient, who approves them before they appear.",
      cta: "Register your medical center",
      to: "/register/medical_center",
      points: [
        { head: "Direct result delivery", text: "Cut lost papers and follow up calls by skipping the printout." },
        { head: "Trackable uploads", text: "Every report gets a fingerprint that can later show it is unchanged." },
        { head: "Imaging delivery", text: "Scan files go straight to the patient, no CDs needed." },
      ],
    },
    {
      id: "admin",
      label: "Admins",
      title: "Keep the network trustworthy",
      body: "Admins review doctors and medical centers, so every participant on MedLock is who they say they are.",
      cta: "Admin sign in",
      to: "/login",
      points: [
        { head: "License verification", text: "Check doctor licenses before they can request records." },
        { head: "Center review", text: "Approve hospitals, clinics and labs before they can upload." },
        { head: "Privacy for patients", text: "Admin screens never show report content, scan previews or extracted values." },
      ],
    },
  ],
};

export const SECURITY = {
  eyebrow: "See the difference",
  title: "Privacy isn't a setting. It's how MedLock is built.",
  cta: "Create your account",
  stats: [
    { value: "AES 256", text: "Every uploaded file is encrypted before it is stored" },
    { value: "30 days", text: "Fixed access window when a patient approves a doctor" },
    { value: "SHA 256", text: "A fingerprint of each report is recorded on Ethereum Sepolia testnet" },
    { value: "Audit log", text: "Logins, uploads and every access decision are recorded" },
  ],
};

export const HOW = {
  eyebrow: "How it works",
  title: "From lab report to doctor's desk in three steps",
  steps: [
    {
      title: "Reports arrive",
      text: "Labs and hospitals upload results straight to the patient's account, or the patient adds a photo or PDF of a paper report.",
    },
    {
      title: "The patient approves",
      text: "A doctor asks for access using the patient's email. The patient approves or declines, and the decision goes into the audit log.",
    },
    {
      title: "The doctor reviews",
      text: "The full history is ready before the visit, so the consultation is spent on decisions. Access ends after 30 days.",
    },
  ],
};

export const HELP = {
  title: "Let us help you",
  cards: [
    {
      icon: "user",
      title: "For patients",
      text: "Create an account and keep your full medical history in one secure place.",
      link: "Create your account",
      to: "/register/patient",
    },
    {
      icon: "building",
      title: "For hospitals, clinics and labs",
      text: "Register your medical center to deliver results directly into patient records.",
      link: "Register your center",
      to: "/register/medical_center",
    },
  ],
};

export const FOOTER = {
  tagline: "Medical record management with the patient in control.",
  columns: [
    {
      title: "Platform",
      links: [
        { label: "Encryption", href: "#security" },
        { label: "Audit trail", href: "#security" },
        { label: "Report reading", href: "#platform" },
      ],
    },
    {
      title: "Who We Serve",
      links: [
        { label: "Patients", href: "#roles", role: "patient" },
        { label: "Doctors", href: "#roles", role: "doctor" },
        { label: "Medical centers", href: "#roles", role: "center" },
      ],
    },
  ],
  note: "MedLock is a university project. Fingerprints are recorded on a public test network, not on a production blockchain, and MedLock does not claim any medical compliance certification. It never gives a diagnosis, and it reads printed or typed text only.",
};

export const PROJECT = {
  university: "FAST NUCES Islamabad",
  year: "2026",
  team: ["Shehbaz Karim", "Shabo Kiran", "Abyaz Israr"],
  supervisor: "Mr. Muhammad Almas Khan",
  repo: "https://github.com/Quttoshi/MedLock",
};
