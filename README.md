# tongpin

一起搭 · 盲盒版的 Convex 后端。前端接口见 [docs/api.md](docs/api.md)。

## 本地开发

```sh
npm install
npm run push:local   # 本地匿名后端：类型检查 + 推送一次（会自动忽略 CONVEX_DEPLOY_KEY）
npm run dev:local    # 同上，持续监听
npm test             # vitest + convex-test
npm run typecheck
```

本地部署开 MOCK：`env -u CONVEX_DEPLOY_KEY CONVEX_AGENT_MODE=anonymous npx convex env set MOCK_AI 1`。

Convex 1.50 起 `--local` 参数已废弃；`CONVEX_AGENT_MODE=anonymous npx convex dev` 本身就跑本地后端。必须去掉 `CONVEX_DEPLOY_KEY`，否则会推到共享部署。
