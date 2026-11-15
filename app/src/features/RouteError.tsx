import type { ErrorBoundaryProps } from "expo-router";
import { errorText } from "../lib/errors";
import { Button, ErrorText, Screen } from "../components/ui";

// 路由级错误边界：query 抛出的 ConvexError（比如 USER_NOT_FOUND）显示成中文。
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <Screen>
      <ErrorText>{errorText(error)}</ErrorText>
      <Button title="重试" kind="secondary" onPress={retry} />
    </Screen>
  );
}
