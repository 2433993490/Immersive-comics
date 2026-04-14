# Comic Image Translator Chrome Extension

一个模仿沉浸式翻译漫画图片翻译效果的 Chrome 扩展。它会识别页面中的图片文字、翻译并以覆盖层形式渲染译文。

## 功能

- 自动扫描页面中的漫画图片（可在 Popup 中一键扫描）。
- 默认使用腾讯翻译君（Transmart）免配置源，Google/微软可在设置中手动切换。
- Popup 布局参考沉浸式翻译（语言切换 / 翻译服务 / OCR 识别 / AI 专家模式 / 嵌入效果 / 一键翻译）。
- 支持按翻译服务分别保存 API 配置（Endpoint / API Key / 模型 / 模板）。
- 支持自定义 OCR 源（内置 OCR.Space + 自定义 OCR API）。
- 译文以“沉浸式嵌入”方式覆盖在识别文本框区域内（自适应字号、居中排版、可点击复制）。
- 支持前端弹窗切换翻译模式（标准 / AI 专家）与覆盖样式（沉浸式 / 双语 / 极简高亮）。
- AI 专家策略基于 Prompt，可在弹窗中直接选择“通用 / 漫画 / 技术 / 新闻 / GitHub”，并可跳转到社区仓库查看与贡献：`https://github.com/immersive-translate/prompts`。
- 注意：AI 术语库/AI 专家策略默认不支持谷歌/微软等机器翻译源，仅在 AI 翻译服务（如 Claude/Gemini/OpenAI 等）下生效。
- 免费图片翻译优先使用浏览器 OCR 直接识别文字；由于浏览器技术限制，目前仅 Chrome / Edge 支持。
- 设置页新增“自定义 AI 源（沉浸式风格填写区）”，可直接填写 Endpoint / Key / 模型 / Prompt，并一键套用 OpenAI/Claude 模板。
- 已增加漫画站点适配扫描策略（按域名关键字 + 站点选择器），优先适配你给出的沉浸式翻译常见漫画站（如 Pixiv、MANGA Plus、MangaDex、ComicWalker、腾讯动漫、Bilibili Manga、Webtoons、Lezhin、Kakao、Batoto、AsuraScans、Comick 等）。

## 安装

1. 打开 `chrome://extensions/`
2. 打开「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目目录

## 使用

1. 打开任意包含漫画图片的网页。
2. 点击插件图标，在 Popup 点击「扫描当前页面图片」。
3. 点击图片左上角出现的「翻译漫画」按钮。
4. 稍等后会在图片上显示翻译结果覆盖层。

## 设置说明

在 Popup 中点击「打开设置页」可配置：

- **翻译源**
  - `google`（默认）
  - `claude` / `deepl` / `deepseek` / `gemini` / `openl`
  - `azureOpenai` / `azureTranslator`
  - `aliyunBailian` / `qwenMt` / `aliyunTranslate`
  - `baiduQianfan` / `doubao` / `baiduTranslate`
  - `caiyun` / `volcengine` / `tencentTransmart` / `niutrans`
  - `youdao` / `youdaoLlm`
  - `custom`（自定义 REST 接口）
- **OCR 源**
  - `browser`（默认，免费浏览器 OCR，仅支持 Chrome / Edge）
  - `ocrspace`（免费 OCR 接口）
  - `baiduOcr`（内置百度 OCR，支持 Access Token 或 API Key + Secret Key 自动换 token）
  - `custom`（自定义 OCR REST 接口）

### 自定义接口模板变量

翻译/OCR 自定义 Body 模板支持以下占位符：

- `{{text}}`: 待翻译文本
- `{{targetLang}}`: 目标语言，如 `zh-CN`
- `{{sourceLang}}`: 源语言，如 `auto`
- `{{imageBase64}}`: 图片 Base64（不含前缀）
- `{{imageUrl}}`: 图片 URL

默认请求头模板为 JSON（每行一个 `Key: Value`）。

## 注意事项

- 跨域请求由 `background service worker` 统一发起。
- OCR.Space 免费额度有限，建议在设置中替换为你自己的 OCR API。
- Google / 微软翻译为免配置免费源，无需填写 API 参数。

## 项目结构

- `manifest.json` - 扩展清单
- `background.js` - 请求代理、OCR/翻译编排
- `content.js` - 页面图片扫描、按钮注入、覆盖层渲染
- `content.css` - 覆盖层视觉样式
- `popup.html` / `popup.js` - 快速操作入口
- `options.html` / `options.js` - 配置管理
