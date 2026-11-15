import { useCallback, useState } from "react";
import { showError } from "./errors";

// 包一层异步操作：执行期间 busy=true，失败时弹中文错误提示。
export function useTask() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    try {
      return await task();
    } catch (error) {
      showError(error);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
