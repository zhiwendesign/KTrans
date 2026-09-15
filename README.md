# KTrans

KTrans 是一款轻量、隐私优先的浏览器划词翻译扩展。选择网页文字后即可通过用户自行配置的大模型 API 获取翻译结果，并支持流式输出、复制、重试和快捷键操作。

KTrans 不建设翻译中转服务。API Key 保存在浏览器本地，翻译请求由扩展后台直接发送至用户配置的服务。

## 功能特性

- 网页划词后显示快捷翻译按钮
- 使用 Shadow DOM 隔离网页与扩展样式
- 流式显示译文，支持停止、重试和一键复制
- 支持 OpenAI-compatible 与 Anthropic-compatible API
- 支持 Ollama、LM Studio 等本地兼容服务
- 添加、编辑、删除和切换翻译服务
- API 连接测试与按域名权限授权
- 自动检测源语言并选择目标语言
- 支持右键菜单与键盘快捷键
- 可针对当前网站启用或禁用
- 支持浅色、深色和跟随系统主题
- 支持 Chrome、Edge Manifest V3

## 技术栈

- [WXT](https://wxt.dev/)
- React
- TypeScript
- Manifest V3
- Lucide Icons
- Vitest

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- Chrome 或 Edge

### 安装与开发

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run check
```

构建产物位于 `.output/chrome-mv3`。生成可发布 ZIP：

```bash
npm run zip
```

## 在 Chrome 中加载

1. 执行 `npm run build`。
2. 在地址栏打开 `chrome://extensions`。
3. 开启右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择项目中的 `.output/chrome-mv3` 目录。
6. 打开 KTrans 设置页，添加翻译服务并测试连接。

修改 Content Script 或 Manifest 后，需要在扩展管理页重新加载扩展，并刷新用于测试的网页。

## 配置翻译服务

打开扩展设置页并填写以下字段：

| 配置项 | 说明 |
| --- | --- |
| 服务名称 | 用于区分不同的 API 配置 |
| 接口协议 | OpenAI-compatible 或 Anthropic-compatible |
| Base URL | API 基础地址，无需添加最终接口路径 |
| API Key | 本地免鉴权服务可以留空 |
| 模型名称 | API 服务支持的模型 ID |
| Temperature | 默认值为 `0.2` |
| 最大 Tokens | 留空时使用默认设置 |
| 请求超时 | 支持 10 至 180 秒 |
| 自定义 Headers | JSON 格式的字符串键值对象 |

点击“测试连接”时，浏览器会请求访问对应 API 域名的权限。授权成功后，KTrans 会使用一段简短文本验证当前配置。

### OpenAI

```text
协议：OpenAI-compatible
Base URL：https://api.openai.com/v1
模型：gpt-4o-mini
API Key：你的 OpenAI API Key
```

### Anthropic

```text
协议：Anthropic-compatible
Base URL：https://api.anthropic.com
模型：填写服务当前支持的 Claude 模型 ID
API Key：你的 Anthropic API Key
```

### Ollama

启动 Ollama 的 OpenAI-compatible 接口后配置：

```text
协议：OpenAI-compatible
Base URL：http://localhost:11434/v1
模型：本地已安装的模型名称
API Key：留空
```

### LM Studio

在 LM Studio 中启动本地服务器后配置：

```text
协议：OpenAI-compatible
Base URL：http://localhost:1234/v1
模型：当前加载的模型名称
API Key：留空
```

模型名称请以对应服务实际提供的模型 ID 为准。

## 使用方法

### 划词翻译

1. 在普通网页中选择一段文字。
2. 点击选区附近出现的 KTrans 图标。
3. 在浮窗中查看流式翻译结果。
4. 点击复制按钮获取完整译文。

触发方式可以设置为“显示翻译图标”“选择后立即翻译”或“仅使用快捷键”。

### 快捷键

```text
Windows / Linux：Ctrl + Shift + S
macOS：Command + Shift + S
```

快捷键可以在浏览器的扩展快捷键管理页面中修改。

### 右键菜单

选择文字后打开浏览器右键菜单，点击“使用 KTrans 翻译”。

## 项目结构

```text
entrypoints/
  background.ts          后台请求、流式消息、右键菜单和快捷键
  content/               划词检测与 Shadow DOM 翻译浮窗
  options/               Provider 和扩展偏好设置
  popup/                 工具栏快捷面板
src/
  providers/             OpenAI / Anthropic 协议适配
  constants.ts           默认配置和语言列表
  storage.ts             浏览器本地存储
  types.ts               共享类型
wxt.config.ts            WXT 与 Manifest 配置
```

## 开发命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Chrome 开发模式 |
| `npm run dev:firefox` | 启动 Firefox 开发模式 |
| `npm run test` | 运行 Vitest 测试 |
| `npm run compile` | 执行 TypeScript 类型检查 |
| `npm run build` | 构建 Chrome MV3 扩展 |
| `npm run build:firefox` | 构建 Firefox 扩展 |
| `npm run check` | 执行类型检查和生产构建 |
| `npm run zip` | 生成 Chrome 发布压缩包 |

## 隐私与安全

- Provider 配置和 API Key 保存于 `browser.storage.local`。
- API Key 只由 Background Service Worker 读取。
- API Key 不会注入网页，也不会发送给 Content Script。
- 选中文字只会发送给用户配置的 API 地址。
- 模型输出按照不可信纯文本处理，不作为 HTML 执行。
- 项目不包含账号、广告、遥测或自有翻译中转服务。

浏览器本地扩展存储并不是操作系统级密码保险箱。请保护好浏览器环境，并避免翻译密码、身份信息和其他敏感内容。

## 当前限制

- 浏览器内部页面、Chrome Web Store 等受限页面无法注入 Content Script。
- Canvas 中绘制的文字无法直接选择和翻译。
- 跨域 iframe 的选区能力取决于页面结构和浏览器权限。
- 当前版本没有整页翻译、OCR、翻译历史和云端同步。
- 尚未完成 Chrome Web Store 和 Edge Add-ons 正式发布流程。

## 路线图

- 多 Provider 功能路由
- 自定义翻译 Prompt
- 单词词典卡片和发音
- 翻译缓存与配置导入导出
- Firefox 完整兼容验证
- 整页双语翻译
- 截图与图片翻译

## 测试

```bash
npm run test
```

当前测试覆盖 Provider Prompt、接口地址拼接和非法协议校验。后续将补充 SSE 数据解析、Background 消息通道和 Playwright 扩展端到端测试。

## 参考项目

- [llm-translate](https://github.com/Junrin-Lee/llm-translate)
- [WXT](https://github.com/wxt-dev/wxt)

KTrans 的产品范围和代码实现保持独立。复用第三方代码前请检查对应项目的许可证和署名要求。
