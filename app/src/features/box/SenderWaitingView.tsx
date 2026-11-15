import type { BoxView } from "../../lib/backend";
import { SendFlow } from "../../screens/send/SendFlow";

// A 寄出后、开盒之前的页面都在 screens/send（UI-2）。
export function SenderWaitingView({ box }: { box: BoxView }) {
  return <SendFlow box={box} />;
}
