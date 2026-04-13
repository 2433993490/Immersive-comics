import { getConfig, saveConfig } from "./config.js";

const $ = (id) => document.getElementById(id);
const BUILTIN_TRANSLATOR_PRESETS = {
  claude: {
    endpoint: "https://api.anthropic.com/v1/messages",
    headers:
      "Content-Type: application/json\nx-api-key: <YOUR_API_KEY>\nanthropic-version: 2023-06-01",
    bodyTemplate:
      "{\n  \"model\": \"claude-3-5-sonnet-latest\",\n  \"max_tokens\": 1024,\n  \"messages\": [{\"role\": \"user\", \"content\": \"Translate from {{sourceLang}} to {{targetLang}}:\\n{{text}}\"}]\n}",
    responsePath: "content.0.text"
  },
  deepl: {
    endpoint: "https://api.deepl.com/v2/translate",
    headers: "Content-Type: application/json\nAuthorization: DeepL-Auth-Key <YOUR_API_KEY>",
    bodyTemplate:
      "{\n  \"text\": [\"{{text}}\"],\n  \"source_lang\": \"{{sourceLang}}\",\n  \"target_lang\": \"{{targetLang}}\"\n}",
    responsePath: "translations.0.text"
  },
  deepseek: {
    endpoint: "https://api.deepseek.com/chat/completions",
    headers: "Content-Type: application/json\nAuthorization: Bearer <YOUR_API_KEY>",
    bodyTemplate:
      "{\n  \"model\": \"deepseek-chat\",\n  \"messages\": [{\"role\": \"user\", \"content\": \"Translate from {{sourceLang}} to {{targetLang}}:\\n{{text}}\"}]\n}",
    responsePath: "choices.0.message.content"
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
    headers: "Content-Type: application/json",
    bodyTemplate:
      "{\n  \"contents\": [{\"parts\": [{\"text\": \"Translate from {{sourceLang}} to {{targetLang}}:\\n{{text}}\"}]}]\n}",
    responsePath: "candidates.0.content.parts.0.text"
  },
  openl: {
    endpoint: "https://api.openl.club/services/{codename}/translate",
    headers: "Content-Type: application/json\nAuthorization: Bearer <YOUR_API_KEY>",
    bodyTemplate:
      "{\n  \"text\": \"{{text}}\",\n  \"source_lang\": \"{{sourceLang}}\",\n  \"target_lang\": \"{{targetLang}}\"\n}",
    responsePath: "data.translation"
  },
  azureOpenai: {
    endpoint: "https://openai-api.immersivetranslate.com/v1/chat/completions",
    headers: "Content-Type: application/json\nAuthorization: Bearer <YOUR_API_KEY>",
    bodyTemplate:
      "{\n  \"model\": \"gpt-4o-mini\",\n  \"messages\": [{\"role\": \"user\", \"content\": \"Translate from {{sourceLang}} to {{targetLang}}:\\n{{text}}\"}]\n}",
    responsePath: "choices.0.message.content"
  },
  aliyunBailian: {
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    headers: "Content-Type: application/json\nAuthorization: Bearer <YOUR_API_KEY>",
    bodyTemplate:
      "{\n  \"model\": \"qwen-plus\",\n  \"messages\": [{\"role\": \"user\", \"content\": \"Translate from {{sourceLang}} to {{targetLang}}:\\n{{text}}\"}]\n}",
    responsePath: "choices.0.message.content"
  },
  qwenMt: {
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    headers: "Content-Type: application/json\nAuthorization: Bearer <YOUR_API_KEY>",
    bodyTemplate:
      "{\n  \"model\": \"qwen-mt-turbo\",\n  \"messages\": [{\"role\": \"user\", \"content\": \"Translate from {{sourceLang}} to {{targetLang}}:\\n{{text}}\"}]\n}",
    responsePath: "choices.0.message.content"
  },
  aliyunTranslate: {
    endpoint: "https://{service}.aliyuncs.com?{paramsString}",
    headers: "Content-Type: application/json",
    bodyTemplate:
      "{\n  \"text\": \"{{text}}\",\n  \"source\": \"{{sourceLang}}\",\n  \"target\": \"{{targetLang}}\"\n}",
    responsePath: "Data.Translated"
  },
  baiduQianfan: {
    endpoint:
      "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/{model}?access_token={key}",
    headers: "Content-Type: application/json",
    bodyTemplate:
      "{\n  \"messages\": [{\"role\": \"user\", \"content\": \"Translate from {{sourceLang}} to {{targetLang}}:\\n{{text}}\"}]\n}",
    responsePath: "result"
  },
  doubao: {
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    headers: "Content-Type: application/json\nAuthorization: Bearer <YOUR_API_KEY>",
    bodyTemplate:
      "{\n  \"model\": \"<YOUR_MODEL>\",\n  \"messages\": [{\"role\": \"user\", \"content\": \"Translate from {{sourceLang}} to {{targetLang}}:\\n{{text}}\"}]\n}",
    responsePath: "choices.0.message.content"
  },
  baiduTranslate: {
    endpoint: "https://api.fanyi.baidu.com/api/trans/vip/translate",
    headers: "Content-Type: application/json",
    bodyTemplate:
      "{\n  \"q\": \"{{text}}\",\n  \"from\": \"{{sourceLang}}\",\n  \"to\": \"{{targetLang}}\",\n  \"appid\": \"<APP_ID>\",\n  \"salt\": \"<SALT>\",\n  \"sign\": \"<SIGN>\"\n}",
    responsePath: "trans_result.0.dst"
  },
  caiyun: {
    endpoint: "https://api.interpreter.caiyunai.com/v1/translator",
    headers: "Content-Type: application/json\nx-authorization: token <YOUR_TOKEN>",
    bodyTemplate:
      "{\n  \"source\": [\"{{text}}\"],\n  \"trans_type\": \"{{sourceLang}}2{{targetLang}}\",\n  \"request_id\": \"comic-translator\",\n  \"detect\": true\n}",
    responsePath: "target.0"
  },
  volcengine: {
    endpoint: "https://translate.volcengine.com/crx/translate/v1/",
    headers: "Content-Type: application/json",
    bodyTemplate:
      "{\n  \"text\": \"{{text}}\",\n  \"source_language\": \"{{sourceLang}}\",\n  \"target_language\": \"{{targetLang}}\"\n}",
    responsePath: "translation"
  },
  tencentTransmart: {
    endpoint: "https://transmart.qq.com/api/imt",
    headers: "Content-Type: application/json",
    bodyTemplate:
      "{\n  \"source\": {\"lang\": \"{{sourceLang}}\", \"text_list\": [\"{{text}}\"]},\n  \"target\": {\"lang\": \"{{targetLang}}\"}\n}",
    responsePath: "auto_translation.0"
  },
  niutrans: {
    endpoint: "https://api.niutrans.com/NiuTransServer/translation",
    headers: "Content-Type: application/json",
    bodyTemplate:
      "{\n  \"src_text\": \"{{text}}\",\n  \"from\": \"{{sourceLang}}\",\n  \"to\": \"{{targetLang}}\",\n  \"apikey\": \"<YOUR_API_KEY>\"\n}",
    responsePath: "tgt_text"
  },
  youdao: {
    endpoint: "https://openapi.youdao.com/api",
    headers: "Content-Type: application/json",
    bodyTemplate:
      "{\n  \"q\": \"{{text}}\",\n  \"from\": \"{{sourceLang}}\",\n  \"to\": \"{{targetLang}}\",\n  \"appKey\": \"<APP_KEY>\",\n  \"salt\": \"<SALT>\",\n  \"sign\": \"<SIGN>\"\n}",
    responsePath: "translation.0"
  },
  youdaoLlm: {
    endpoint: "https://openapi.youdao.com/llm_trans",
    headers: "Content-Type: application/json",
    bodyTemplate:
      "{\n  \"q\": \"{{text}}\",\n  \"from\": \"{{sourceLang}}\",\n  \"to\": \"{{targetLang}}\",\n  \"appKey\": \"<APP_KEY>\",\n  \"salt\": \"<SALT>\",\n  \"sign\": \"<SIGN>\"\n}",
    responsePath: "translation"
  }
};

const PROVIDER_LABELS = {
  google: "谷歌翻译",
  claude: "Claude",
  deepl: "DeepL",
  deepseek: "DeepSeek",
  gemini: "Gemini",
  openl: "OpenL",
  azureOpenai: "Open AI (Azure)",
  azureTranslator: "微软翻译",
  aliyunBailian: "阿里云百炼",
  qwenMt: "Qwen-MT",
  aliyunTranslate: "阿里云翻译",
  baiduQianfan: "百度千帆",
  doubao: "豆包",
  baiduTranslate: "百度翻译",
  caiyun: "彩云小译",
  volcengine: "火山引擎",
  tencentTransmart: "腾讯翻译君",
  niutrans: "小牛翻译",
  youdao: "有道翻译",
  youdaoLlm: "有道子曰",
  custom: "自定义接口"
};
const PROVIDER_ORDER = ["google", "azureTranslator", ...Object.keys(BUILTIN_TRANSLATOR_PRESETS), "custom"];
const BUILTIN_NO_SETUP_PROVIDERS = new Set(["google", "azureTranslator"]);


init();

async function init() {
  const config = await getConfig();
  bind(config);

  $("saveBtn")?.addEventListener("click", async () => {
    const next = collect();
    await saveConfig(next);
    const msg = $("msg");
    msg.textContent = "已保存";
    setTimeout(() => (msg.textContent = ""), 1800);
  });
}

function bind(config) {
  $("sourceLang").value = config.sourceLang;
  $("targetLang").value = config.targetLang;

  $("translatorProvider").value = config.translator.provider;
  $("customTranslateEndpoint").value = config.translator.custom.endpoint;
  $("customTranslateHeaders").value = config.translator.custom.headers;
  $("customTranslateBody").value = config.translator.custom.bodyTemplate;
  $("customTranslatePath").value = config.translator.custom.responsePath;

  if (
    config.translator.provider !== "google" &&
    config.translator.provider !== "custom" &&
    !config.translator.custom.endpoint
  ) {
    const preset = BUILTIN_TRANSLATOR_PRESETS[config.translator.provider];
    if (preset) applyPresetToForm(preset);
  }

  $("aiEnabled").checked = config.ai.enabled;
  $("aiEndpoint").value = config.ai.endpoint;
  $("aiKey").value = config.ai.apiKey;
  $("aiModel").value = config.ai.model;
  $("aiHeaders").value = config.ai.headers;
  $("aiPrompt").value = config.ai.promptTemplate;
  $("aiBody").value = config.ai.bodyTemplate;
  $("aiPath").value = config.ai.responsePath;

  $("ocrProvider").value = config.ocr.provider;
  $("ocrSpaceKey").value = config.ocr.ocrSpaceApiKey;
  $("customOcrEndpoint").value = config.ocr.custom.endpoint;
  $("customOcrHeaders").value = config.ocr.custom.headers;
  $("customOcrBody").value = config.ocr.custom.bodyTemplate;
  $("customOcrPath").value = config.ocr.custom.responsePath;

  renderProviderList();
  updateProviderHeader();
  updateTranslateApiSection();
}

function collect() {
  return {
    sourceLang: $("sourceLang").value.trim() || "auto",
    targetLang: $("targetLang").value.trim() || "zh-CN",
    translator: {
      provider: $("translatorProvider").value,
      googleEndpoint: "https://translate.googleapis.com/translate_a/single",
      azureTranslatorEndpoint: "https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0",
      custom: {
        endpoint: $("customTranslateEndpoint").value.trim(),
        headers: $("customTranslateHeaders").value,
        bodyTemplate: $("customTranslateBody").value,
        responsePath: $("customTranslatePath").value.trim()
      }
    },
    ai: {
      enabled: $("aiEnabled").checked,
      endpoint: $("aiEndpoint").value.trim(),
      apiKey: $("aiKey").value.trim(),
      model: $("aiModel").value.trim(),
      headers: $("aiHeaders").value,
      promptTemplate: $("aiPrompt").value,
      bodyTemplate: $("aiBody").value,
      responsePath: $("aiPath").value.trim()
    },
    ocr: {
      provider: $("ocrProvider").value,
      ocrSpaceEndpoint: "https://api.ocr.space/parse/image",
      ocrSpaceApiKey: $("ocrSpaceKey").value.trim() || "helloworld",
      custom: {
        endpoint: $("customOcrEndpoint").value.trim(),
        headers: $("customOcrHeaders").value,
        bodyTemplate: $("customOcrBody").value,
        responsePath: $("customOcrPath").value.trim()
      }
    },
    imageFilter: {
      minWidth: 280,
      minHeight: 280
    }
  };
}

function onTranslatorProviderChange(provider) {
  $("translatorProvider").value = provider;
  if (BUILTIN_NO_SETUP_PROVIDERS.has(provider) || provider === "custom") {
    renderProviderList();
    updateProviderHeader();
    updateTranslateApiSection();
    return;
  }

  const preset = BUILTIN_TRANSLATOR_PRESETS[provider];
  if (!preset) return;

  applyPresetToForm(preset);
  renderProviderList();
  updateProviderHeader();
  updateTranslateApiSection();
}

function applyPresetToForm(preset) {
  $("customTranslateEndpoint").value = preset.endpoint;
  $("customTranslateHeaders").value = preset.headers;
  $("customTranslateBody").value = preset.bodyTemplate;
  $("customTranslatePath").value = preset.responsePath;
}

function renderProviderList() {
  const container = $("providerList");
  if (!container) return;

  const current = $("translatorProvider").value || "google";
  container.innerHTML = "";

  PROVIDER_ORDER.forEach((provider) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `provider-item${provider === current ? " active" : ""}`;
    item.dataset.provider = provider;
    item.innerHTML = `
      <span class="provider-name">${PROVIDER_LABELS[provider] || provider}</span>
      <span class="switch" aria-hidden="true"></span>
    `;
    item.addEventListener("click", () => onTranslatorProviderChange(provider));
    container.appendChild(item);
  });
}


function updateTranslateApiSection() {
  const provider = $("translatorProvider").value || "google";
  const hint = $("builtInProviderHint");
  if (!hint) return;

  const isBuiltIn = BUILTIN_NO_SETUP_PROVIDERS.has(provider);
  hint.style.display = isBuiltIn ? "block" : "none";

  ["customTranslateEndpoint", "customTranslateHeaders", "customTranslateBody", "customTranslatePath"].forEach((id) => {
    const node = $(id);
    if (node) node.disabled = isBuiltIn;
  });
}

function updateProviderHeader() {
  const provider = $("translatorProvider").value || "google";
  const el = $("activeProviderTitle");
  if (el) el.textContent = PROVIDER_LABELS[provider] || provider;
}

