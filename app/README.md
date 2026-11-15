# 一起搭 · 盲盒版 — iOS App（Expo 骨架）

最小可用的 Expo（React Native + TypeScript，SDK 58，expo-router）客户端，能把整条故事线走通：
A 拍照寄出 → 盒子 ready 显示盒子码 → B 认领 → 3D 里转角度定格 → 一句话改造 → 封箱 → A 开盒 → 回礼。
界面是朴素的占位样式，结构按"页面 / 业务组件 / 基础组件 / 后端接入"分好，方便前端同学替换 UI。

后端在仓库根目录的 `convex/`，接口说明见 [../docs/api.md](../docs/api.md)，调用顺序可以对照 [../scripts/e2e.ts](../scripts/e2e.ts)。

## 本地跑

```bash
cd app
npm ci
npx expo run:ios          # 需要 macOS + Xcode；生成 ios/ 并装到模拟器或连着的 iPhone
# 之后改 JS 只要
npx expo start            # 用上面装好的 development build 连 Metro
```

用到了 Expo Go 之外的原生模块（webview、image-manipulator 等都在 Expo Go 里有，但以 development build 为准），
所以推荐 `expo run:ios` 或 EAS development build，而不是 Expo Go。

类型检查：`npm run typecheck`（= `tsc --noEmit`，会连带检查 App 引用到的 `../convex` 文件）。

## 构建

不依赖 EAS 也能出模拟器包（Revyl 云构建用的就是这一套，工作目录是仓库根目录）：

```bash
cd app && npm ci
npx expo prebuild --platform ios --no-install
cd ios && pod install
xcodebuild -workspace app.xcworkspace -scheme app -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
# 产物：app/ios/build/Build/Products/Release-iphonesimulator/app.app
```

真机包用 EAS（`npx eas-cli@latest build -p ios`）或 Xcode 签名，bundle id 是 `com.zigeh.tongpin`（见 app.json）。
`ios/`、`android/` 是 prebuild 生成的，不进仓库，原生配置改 app.json。

注意：App 会打包仓库根目录的 `convex/_generated/api.js`，所以构建时需要整个仓库（不能只拷 app/）。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `EXPO_PUBLIC_CONVEX_URL` | `https://moonlit-curlew-733.convex.cloud` | Convex 部署地址。构建时内联进 JS 包，改了要重新打包；本地可以写在 `app/.env.local` |

本地匿名后端（根目录 `npm run dev:local`）跑起来后，把 `.env.local` 里的 `CONVEX_URL` 填给 `EXPO_PUBLIC_CONVEX_URL`
（模拟器能访问 127.0.0.1，真机要换成电脑的局域网地址）。

## 目录结构

```
app/
  app.json             Expo 配置（名字、bundle id、相机/相册权限文案）
  metro.config.js      让 Metro 能打包 ../convex，并从 app/node_modules 解析依赖
  tsconfig.json        convex/* 指到 app/node_modules（根目录不装依赖也能类型检查）
  src/
    app/               expo-router 页面（每个文件一个路由）
      _layout.tsx      ConvexProvider + 本地身份 + Stack；没注册时只开放首页和设置
      index.tsx        Inbox（boxes.inbox 实时订阅）/ 未注册时显示注册
      settings.tsx     本机身份列表：切换、注册新昵称、忘掉（一台手机扮演 A 和 B）
      new.tsx          A：拍照/相册 → 转 JPEG → 上传 → boxes.create
      claim.tsx        B：输入盒子码 → boxes.claim
      box/[id].tsx     一个盒子一页，按"我是谁 + 状态"分发到下面的视图
    features/
      box/             盒子各阶段的视图
        SenderWaitingView  A 等 ready、显示盒子码
        ClaimView          B 认领（inbox action = claim）
        EditView           B 定格 + 一句话 + 参考照片 + 封箱（action = edit）
        OpenView           A 开盒（action = open）
        ResultView         开盒后的结果 + 回礼
      RegisterForm.tsx, RouteError.tsx
    components/
      ModelViewer.tsx  react-native-webview + three.js 看 GLB、拖动旋转、capture() 定格
      viewerHtml.ts    WebView 里的 three.js 页面（three 从 jsDelivr 加载）
      ui.tsx           朴素的基础组件（按钮、输入框…），换 UI 从这里开始
    lib/
      backend.ts       ConvexReactClient、api 和后端类型的唯一入口
      session.tsx      userId 存 expo-secure-store，可以存多个身份
      upload.ts        files.generateUploadUrl → POST → storageId
      images.ts        expo-image-picker 选图；expo-image-manipulator 转 JPEG、长边 ≤ 1536
      errors.ts        ConvexError data.code → 中文提示
      useTask.ts       异步按钮的 busy 状态 + 统一错误弹窗
```

## 几个约定

- 后端函数、类型都从 `src/lib/backend.ts` 拿（`api`、`Id`、`BoxView`、`CameraPose`），不要在页面里写 `../../../convex`。
- 盒子状态全靠 `boxes.get` / `boxes.inbox` 实时订阅刷新，mutation 之后不用手动刷新。
- 定格图：WebView 里 `renderer` 开了 `alpha` 和 `preserveDrawingBuffer`，`toDataURL("image/png")` 得到透明背景 PNG，
  经 `postMessage` 回到 App，写进缓存文件再上传；同时带上相机的 `position / target / fov` 作为 `cameraPose`。
- 相册选图用 `preferredAssetRepresentationMode: Current` 拿原始文件（常见 HEIC），一律转 JPEG 再上传。
- 没有登录、没有推送。
