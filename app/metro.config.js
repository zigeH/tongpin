const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const appRoot = __dirname;
const repoRoot = path.resolve(appRoot, "..");

const config = getDefaultConfig(appRoot);

// App 直接引用仓库根目录的 convex/_generated/api（以及 convex/lib 里的类型），
// 所以要让 Metro 能看到 ../convex，并且从 app/node_modules 解析它的依赖（根目录不装依赖）。
config.watchFolders = [path.join(repoRoot, "convex")];
config.resolver.nodeModulesPaths = [path.join(appRoot, "node_modules")];

module.exports = config;
