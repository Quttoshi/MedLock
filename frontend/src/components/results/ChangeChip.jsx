import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { changeText } from "../../utils/results";

/**
 * How a value moved since the previous result. It states the direction without
 * judging it (a falling LDL is good, a falling haemoglobin is not); a change larger
 * than the test's usual variation is marked "notable".
 */
export default function ChangeChip({ change, decimals = 1 }) {
  if (!change) return null;
  const Icon = change.direction === "up" ? ArrowUpRight : change.direction === "down" ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${change.significant ? "font-semibold text-ink" : "text-muted"}`}>
      <Icon aria-hidden="true" size={14} />
      {changeText(change, decimals)}
      {change.significant && <span className="rounded-full bg-inset px-2 py-0.5 text-[11px]">notable</span>}
    </span>
  );
}
