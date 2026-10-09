import DashTopNav from "./DashTopNav";
import { PATIENT_LINKS } from "./patientLinks";

// Top bar for the patient screens. Same routes as before.
export default function PatientTopNav() {
  return <DashTopNav links={PATIENT_LINKS} homePath="/patient/dashboard" notificationsPath="/patient/notifications" />;
}
