import type { BoxView } from "../../lib/backend";
import { OpenScreen } from "../../screens/open/OpenScreen";

// A：B 已封箱，开盲盒；开盒后同一个页面留着看结果、接力寄回。
export function OpenView({ box }: { box: BoxView }) {
  return <OpenScreen box={box} />;
}
