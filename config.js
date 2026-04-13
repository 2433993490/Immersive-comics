export const TRANSLATOR_PROVIDER_OPTIONS = [
  { value: "google", label: "Google (默认)", endpoint: "https://translate.googleapis.com/translate_a/single" },
  { value: "claude", label: "Claude", endpoint: "https://api.anthropic.com/v1/messages" },
  { value: "deepl", label: "DeepL", endpoint: "https://api.deepl.com/v2/translate" },
  { value: "deepseek", label: "DeepSeek", endpoint: "https://api.deepseek.com/chat/completions" },
  {
    value: "gemini",
    label: "Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent?key={{key}}"
  },
  { value: "openl", label: "OpenL", endpoint: "https://api.openl.club/services/{{codename}}/translate" },
  {
    value: "azure_openai",
    label: "OpenAI (Azure OpenAI)",
    endpoint: "https://openai-api.immersivetranslate.com/v1/chat/completions"
  },
  {
    value: "azure_translator",
    label: "微软 Azure 翻译",
    endpoint: "https://api.cognitive.microsofttranslator.com/translate?x=2"
  },
  {
    value: "bailian",
    label: "阿里云百炼大模型",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
  },
  {
    value: "qwen_mt",
    label: "Qwen-MT",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
  },
  { value: "aliyun_translate", label: "阿里云翻译", endpoint: "https://{{service}}.aliyuncs.com?{{paramsString}}" },
  {
    value: "baidu_qianfan",
    label: "百度千帆大模型",
    endpoint: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/{{model}}?access_token={{key}}"
  },
  {
    value: "doubao",
    label: "字节跳动豆包大模型",
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
  },
  { value: "baidu_fanyi", label: "百度翻译", endpoint: "https://api.fanyi.baidu.com/api/trans/vip/translate" },
  { value: "caiyun", label: "彩云小译", endpoint: "https://api.interpreter.caiyunai.com/v1/translator" },
  { value: "volcengine", label: "火山引擎", endpoint: "https://translate.volcengine.com/crx/translate/v1/" },
  { value: "qq_transmart", label: "腾讯翻译君", endpoint: "https://transmart.qq.com/api/imt" },
  { value: "niutrans", label: "小牛翻译", endpoint: "https://api.niutrans.com/NiuTransServer/translation" },
  { value: "youdao", label: "有道翻译", endpoint: "https://openapi.youdao.com/api" },
  { value: "youdao_llm", label: "有道子曰大模型翻译", endpoint: "https://openapi.youdao.com/llm_trans" },
  { value: "custom", label: "自定义接口翻译", endpoint: "" }
];

export const DEFAULT_CONFIG = {
  targetLang: "zh-CN",
  sourceLang: "auto",
  translator: {
    provider: "google",
    endpoint: "https://translate.googleapis.com/translate_a/single",
    apiKey: "",
    apiSecret: "",
    model: "",
    service: "",
    paramsString: "",
    codename: "google",
    region: "",
    customHeaders: "Content-Type: application/json",
    customBodyTemplate: "{\n  \"text\": \"{{text}}\",\n  \"target\": \"{{targetLang}}\"\n}",
    customResponsePath: "data.translation"
  },
  ai: {
    enabled: false,
    endpoint: "",
    apiKey: "",
    model: "",
    headers: "Content-Type: application/json",
    promptTemplate:
      "你是漫画翻译润色助手。请将以下译文润色成自然简洁中文，保留语气与剧情信息，不要额外解释：\n{{text}}",
    bodyTemplate:
      "{\n  \"model\": \"{{model}}\",\n  \"messages\": [{\"role\": \"user\", \"content\": \"{{prompt}}\"}]\n}",
    responsePath: "choices.0.message.content"
  },
  ocr: {
    provider: "ocrspace",
    ocrSpaceEndpoint: "https://api.ocr.space/parse/image",
    ocrSpaceApiKey: "helloworld",
    custom: {
      endpoint: "",
      headers: "Content-Type: application/json",
      bodyTemplate: "{\n  \"image\": \"{{imageBase64}}\"\n}",
      responsePath: "lines"
    }
  },
  imageFilter: {
    minWidth: 280,
    minHeight: 280
  }
};

export async function getConfig() {
  const stored = await chrome.storage.sync.get(["comicTranslatorConfig"]);
  return deepMerge(structuredClone(DEFAULT_CONFIG), stored.comicTranslatorConfig || {});
}

export async function saveConfig(config) {
  await chrome.storage.sync.set({ comicTranslatorConfig: config });
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isObject(value) && isObject(target[key])) {
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
