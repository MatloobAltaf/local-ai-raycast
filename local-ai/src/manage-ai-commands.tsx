import { CommandList } from "./components/CommandList";
import { PreflightGate } from "./components/PreflightGate";

export default function Command() {
  return (
    <PreflightGate>
      <CommandList mode="manage" />
    </PreflightGate>
  );
}
