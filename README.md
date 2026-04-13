# Comic Image Translator Chrome Extension

一个模仿沉浸式翻译漫画图片翻译效果的 Chrome 扩展。它会识别页面中的图片文字、翻译并以覆盖层形式渲染译文。

## 功能

- 自动扫描页面中的漫画图片（可在 Popup 中一键扫描）。
- 默认使用 Google Translate（无需 API Key）。
- 支持自定义翻译 API（Endpoint + Header + Body 模板）。
- 支持自定义 AI 大模型 API（可用于译文润色/改写）。
- 支持自定义 OCR 源（内置 OCR.Space + 自定义 OCR API）。
- 译文以“漫画气泡”样式覆盖在图片上（半透明白底、圆角、阴影、可点击复制）。

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
- **AI 模型（可选）**
  - 关闭
  - 开启并配置 Endpoint / Key / Model / Prompt
- **OCR 源**
  - `ocrspace`（默认，使用 OCR.Space）
  - `custom`（自定义 OCR REST 接口）

### 自定义接口模板变量

翻译/AI/OCR 自定义 Body 模板支持以下占位符：

- `{{text}}`: 待翻译文本
- `{{targetLang}}`: 目标语言，如 `zh-CN`
- `{{sourceLang}}`: 源语言，如 `auto`
- `{{imageBase64}}`: 图片 Base64（不含前缀）
- `{{imageUrl}}`: 图片 URL

默认请求头模板为 JSON（每行一个 `Key: Value`）。

## 注意事项

- 跨域请求由 `background service worker` 统一发起。
- OCR.Space 免费额度有限，建议在设置中替换为你自己的 OCR API。
- AI 润色为可选步骤，若不配置则直接显示机器翻译结果。

## 项目结构

- `manifest.json` - 扩展清单
- `background.js` - 请求代理、OCR/翻译/AI 编排
- `content.js` - 页面图片扫描、按钮注入、覆盖层渲染
- `content.css` - 覆盖层视觉样式
- `popup.html` / `popup.js` - 快速操作入口
- `options.html` / `options.js` - 配置管理
