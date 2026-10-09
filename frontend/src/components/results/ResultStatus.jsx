import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, CircleDashed } from "lucide-react";
import StatusPill from "../ui/StatusPill";
import { resultTone } from "../../utils/results";

/**
 * Plain words for a result ("In range", "Slightly low", "Prediabetes"), with an icon
 * for the direction so the meaning never rests on colour alone.
 */
export default function ResultStatus({ label, flag, band }) {
  const tone = resultTone(flag, band);
  let icon = CheckCircle2;
  if (flag?.startsWith("critical")) icon = AlertTriangle;
  else if (flag === "low") icon = ArrowDown;
  else if (flag === "high") icon = ArrowUp;
  return (
    <StatusPill tone={tone} icon={icon}>
      {label || "In range"}
    </StatusPill>
  );
}

// Shown next to values nobody has checked yet.
export function UncheckedPill() {
  return (
    <StatusPill tone="plain" icon={CircleDashed}>
      Not yet checked
    </StatusPill>
  );
}
