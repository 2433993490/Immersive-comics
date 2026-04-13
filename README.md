# Comic Image Translator Chrome Extension

一个模仿沉浸式翻译漫画图片翻译效果的 Chrome 扩展。它会识别页面中的图片文字、翻译并以覆盖层形式渲染译文。

## 功能

- 自动扫描页面中的漫画图片（可在 Popup 中一键扫描）。
- 默认使用 Google Translate（无需 API Key）。
- 内置多翻译接口选项（Claude / DeepL / DeepSeek / Gemini / OpenL / Azure / 通义 / 千帆 / 豆包 / 百度 / 腾讯 / 有道 等）。
- 支持完全自定义翻译 API（Endpoint + Header + Body 模板 + Response Path）。
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

## 翻译接口（可选）

设置页内置以下 provider（可直接选择并自动填充 endpoint）：

- Claude - `https://api.anthropic.com/v1/messages`
- DeepL - `https://api.deepl.com/v2/translate`
- DeepSeek - `https://api.deepseek.com/chat/completions`
- Gemini - `https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent?key={{key}}`
- OpenL - `https://api.openl.club/services/{{codename}}/translate`
- Open AI (Azure OpenAI) - `https://openai-api.immersivetranslate.com/v1/chat/completions`
- 微软 Azure 翻译 - `https://api.cognitive.microsofttranslator.com/translate?x=2`
- 阿里云百炼大模型 / Qwen-MT - `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- 阿里云翻译 - `https://{{service}}.aliyuncs.com?{{paramsString}}`
- 百度千帆大模型 - `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/{{model}}?access_token={{key}}`
- 字节跳动豆包大模型 - `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- 百度翻译 - `https://api.fanyi.baidu.com/api/trans/vip/translate`
- 彩云小译 - `https://api.interpreter.caiyunai.com/v1/translator`
- 火山引擎 - `https://translate.volcengine.com/crx/translate/v1/`
- 腾讯翻译君 - `https://transmart.qq.com/api/imt`
- 小牛翻译 - `https://api.niutrans.com/NiuTransServer/translation`
- 有道翻译 - `https://openapi.youdao.com/api`
- 有道子曰大模型翻译 - `https://openapi.youdao.com/llm_trans`
- 自定义接口翻译

> 说明：部分平台（如百度/有道等）通常需要签名算法参数。可在设置页通过「自定义 Headers / Body Template / Response Path」对接你自己的代理网关或签名后端。

## 自定义接口模板变量

翻译/AI/OCR 自定义 Body 模板支持以下占位符：

- `{{text}}`: 待翻译文本
- `{{targetLang}}`: 目标语言，如 `zh-CN`
- `{{sourceLang}}`: 源语言，如 `auto`
- `{{imageBase64}}`: 图片 Base64（不含前缀）
- `{{imageUrl}}`: 图片 URL
- `{{model}}` / `{{key}}` / `{{service}}` / `{{paramsString}}` / `{{codename}}`

默认请求头模板为每行一个 `Key: Value`。

## 注意事项

- 跨域请求由 `background service worker` 统一发起。
- OCR.Space 免费额度有限，建议在设置中替换为你自己的 OCR API。
- AI 润色为可选步骤，若不配置则直接显示机器翻译结果。

