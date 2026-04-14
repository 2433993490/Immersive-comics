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
const PROVIDER_ORDER = Array.from(new Set(["tencentTransmart", "google", "azureTranslator", ...Object.keys(BUILTIN_TRANSLATOR_PRESETS), "custom"]));
const BUILTIN_NO_SETUP_PROVIDERS = new Set(["google", "azureTranslator", "tencentTransmart"]);
const MODEL_PROVIDERS = new Set([
  "claude",
  "deepseek",
  "gemini",
  "azureOpenai",
  "aliyunBailian",
  "qwenMt",
  "baiduQianfan",
  "doubao"
]);
const MODEL_OPTIONS = {
  claude: ["claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest", "__custom__"],
  deepseek: ["deepseek-chat", "deepseek-reasoner", "__custom__"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "__custom__"],
  azureOpenai: ["gpt-4o-mini", "gpt-4.1-mini", "__custom__"],
  aliyunBailian: ["qwen-plus", "qwen-max", "__custom__"],
  qwenMt: ["qwen-mt-turbo", "qwen-mt-plus", "__custom__"],
  baiduQianfan: ["ernie-4.0-turbo-8k", "ernie-speed-128k", "__custom__"],
  doubao: ["doubao-1.5-pro-32k", "doubao-1.5-lite-32k", "__custom__"]
};
let providerConfigs = {};


init();

async function init() {
  const config = await getConfig();
  bind(config);

  $("saveBtn")?.addEventListener("click", async () => {
    persistCurrentProviderConfig();
    const next = collect();
    await saveConfig(next);
    const msg = $("msg");
    msg.textContent = "已保存";
    setTimeout(() => (msg.textContent = ""), 1800);
  });

  $("testProviderBtn")?.addEventListener("click", testProviderConnection);
  $("testOcrBtn")?.addEventListener("click", testOcrConnection);
  $("ocrProvider")?.addEventListener("change", updateOcrSection);
  $("aiEndpointMirror")?.addEventListener("input", syncAiMirrorToCustomFields);
  $("aiApiKeyMirror")?.addEventListener("input", syncAiMirrorToCustomFields);
  $("aiModelMirror")?.addEventListener("input", syncAiMirrorToCustomFields);
  $("aiPromptMirror")?.addEventListener("input", syncAiMirrorToCustomFields);
  $("templateOpenAiBtn")?.addEventListener("click", () => applyAiTemplate("openai"));
  $("templateClaudeBtn")?.addEventListener("click", () => applyAiTemplate("claude"));
  $("providerModelSelect")?.addEventListener("change", onModelModeChange);
  $("providerModelCustom")?.addEventListener("input", syncModelHiddenValue);
}

function bind(config) {
  $("sourceLang").value = config.sourceLang;
  $("targetLang").value = config.targetLang;

  $("translatorProvider").value = config.translator.provider;
  providerConfigs = structuredClone(config.translator.providerConfigs || {});

  hydrateProviderConfig(config.translator.provider, config.translator.custom);

  $("ocrProvider").value = config.ocr.provider;
  $("ocrSpaceKey").value = config.ocr.ocrSpaceApiKey;
  $("baiduOcrEndpoint").value = config.ocr.baiduOcrEndpoint || "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic";
  $("baiduOcrToken").value = config.ocr.baiduOcrAccessToken || "";
  $("baiduOcrApiKey").value = config.ocr.baiduOcrApiKey || "";
  $("baiduOcrSecretKey").value = config.ocr.baiduOcrSecretKey || "";
  $("customOcrEndpoint").value = config.ocr.custom.endpoint;
  $("customOcrHeaders").value = config.ocr.custom.headers;
  $("customOcrBody").value = config.ocr.custom.bodyTemplate;
  $("customOcrPath").value = config.ocr.custom.responsePath;

  renderProviderList();
  updateProviderHeader();
  updateTranslateApiSection();
  updateOcrSection();
}

function collect() {
  const provider = $("translatorProvider").value;
  const currentCfg = providerConfigs[provider] || {};
  return {
    sourceLang: $("sourceLang").value.trim() || "auto",
    targetLang: $("targetLang").value.trim() || "zh-CN",
    translator: {
      provider,
      googleEndpoint: "https://translate.googleapis.com/translate_a/single",
      azureTranslatorEndpoint: "https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0",
      providerConfigs,
      custom: {
        endpoint: currentCfg.endpoint || $("customTranslateEndpoint").value.trim(),
        headers: currentCfg.headers || $("customTranslateHeaders").value,
        bodyTemplate: currentCfg.bodyTemplate || $("customTranslateBody").value,
        responsePath: currentCfg.responsePath || $("customTranslatePath").value.trim()
      }
    },
    ocr: {
      provider: $("ocrProvider").value,
      ocrSpaceEndpoint: "https://api.ocr.space/parse/image",
      ocrSpaceApiKey: $("ocrSpaceKey").value.trim() || "helloworld",
      baiduOcrEndpoint: $("baiduOcrEndpoint").value.trim() || "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic",
      baiduOcrAccessToken: $("baiduOcrToken").value.trim(),
      baiduOcrApiKey: $("baiduOcrApiKey").value.trim(),
      baiduOcrSecretKey: $("baiduOcrSecretKey").value.trim(),
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
  persistCurrentProviderConfig();
  $("translatorProvider").value = provider;
  hydrateProviderConfig(provider);
  renderProviderList();
  updateProviderHeader();
  updateTranslateApiSection();
}

function hydrateProviderConfig(provider, fallbackCustom = null) {
  const preset = BUILTIN_TRANSLATOR_PRESETS[provider];
  const fromStore = providerConfigs[provider];
  const fallback = fallbackCustom || {};
  const cfg = fromStore || (preset ? ({
    endpoint: preset.endpoint,
    headers: preset.headers,
    bodyTemplate: preset.bodyTemplate,
    responsePath: preset.responsePath,
    apiKey: "",
    model: ""
  }) : fallback);

  $("providerEndpoint").value = cfg.endpoint || "";
  $("providerApiKey").value = cfg.apiKey || "";
  setupModelFields(provider, cfg.model || "");
  $("customTranslateEndpoint").value = cfg.endpoint || "";
  $("customTranslateHeaders").value = cfg.headers || "Content-Type: application/json";
  $("customTranslateBody").value = cfg.bodyTemplate || "{\n  \"text\": \"{{text}}\",\n  \"target\": \"{{targetLang}}\"\n}";
  $("customTranslatePath").value = cfg.responsePath || "data.translation";
  syncAiMirrorFromCustomFields();
}

function persistCurrentProviderConfig() {
  const provider = $("translatorProvider").value;
  if (!provider) return;

  const selectedModel = $("providerModel").value.trim();
  let bodyTemplate = $("customTranslateBody").value;
  if (MODEL_PROVIDERS.has(provider) && selectedModel) {
    bodyTemplate = bodyTemplate.replace(/"model"\s*:\s*"[^"]*"/, `"model": "${selectedModel}"`);
  }

  const cfg = {
    endpoint: $("providerEndpoint").value.trim() || $("customTranslateEndpoint").value.trim(),
    apiKey: $("providerApiKey").value.trim(),
    model: selectedModel,
    headers: injectApiKey($("customTranslateHeaders").value, $("providerApiKey").value.trim()),
    bodyTemplate,
    responsePath: $("customTranslatePath").value.trim()
  };
  providerConfigs[provider] = cfg;

  $("customTranslateEndpoint").value = cfg.endpoint;
  $("customTranslateHeaders").value = cfg.headers;
  $("customTranslateBody").value = cfg.bodyTemplate;
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
  const isCustom = provider === "custom";
  hint.style.display = isBuiltIn ? "block" : "none";
  const modelVisible = MODEL_PROVIDERS.has(provider);
  $("modelFieldWrap").style.display = modelVisible ? "block" : "none";
  if (modelVisible) {
    setupModelFields(provider, $("providerModel").value.trim());
  }

  ["providerEndpoint", "providerApiKey", "providerModel", "testProviderBtn"].forEach((id) => {
    const node = $(id);
    if (node) node.disabled = isBuiltIn || isCustom;
  });

  ["customTranslateEndpoint", "customTranslateHeaders", "customTranslateBody", "customTranslatePath"].forEach((id) => {
    const node = $(id);
    if (node) node.disabled = isBuiltIn || !isCustom;
  });

  const aiSourceSection = $("aiSourceSection");
  if (aiSourceSection) {
    aiSourceSection.style.display = isCustom || MODEL_PROVIDERS.has(provider) ? "block" : "none";
  }
  ["aiEndpointMirror", "aiApiKeyMirror", "aiModelMirror", "aiPromptMirror", "templateOpenAiBtn", "templateClaudeBtn"].forEach((id) => {
    const node = $(id);
    if (node) node.disabled = isBuiltIn || !isCustom;
  });
}

function updateProviderHeader() {
  const provider = $("translatorProvider").value || "google";
  const el = $("activeProviderTitle");
  if (el) el.textContent = PROVIDER_LABELS[provider] || provider;
}

function injectApiKey(headers, apiKey) {
  if (!apiKey) return headers;
  return String(headers || "")
    .replace("<YOUR_API_KEY>", apiKey)
    .replace("{key}", apiKey);
}

async function testProviderConnection() {
  persistCurrentProviderConfig();
  const resultNode = $("testProviderResult");
  resultNode.textContent = "测试中...";
  const next = collect();
  try {
    const response = await chrome.runtime.sendMessage({
      type: "TEST_TRANSLATOR",
      payload: { config: next }
    });
    if (!response?.ok) throw new Error(response?.error || "测试失败");
    resultNode.textContent = `成功：${response.result}`;
  } catch (error) {
    resultNode.textContent = `失败：${error.message || error}`;
  }
}

async function testOcrConnection() {
  const resultNode = $("testOcrResult");
  resultNode.textContent = "测试中...";
  const next = collect();
  try {
    const response = await chrome.runtime.sendMessage({
      type: "TEST_OCR",
      payload: { config: next }
    });
    if (!response?.ok) throw new Error(response?.error || "测试失败");
    resultNode.textContent = `成功：识别到 ${response.result?.count || 0} 条文本`;
  } catch (error) {
    resultNode.textContent = `失败：${error.message || error}`;
  }
}

function setupModelFields(provider, currentModel) {
  const select = $("providerModelSelect");
  const custom = $("providerModelCustom");
  const hidden = $("providerModel");
  if (!select || !custom || !hidden) return;

  const models = MODEL_OPTIONS[provider] || ["__custom__"];
  select.innerHTML = "";
  for (const model of models) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model === "__custom__" ? "自定义模型..." : model;
    select.appendChild(option);
  }

  const matched = models.includes(currentModel) ? currentModel : "__custom__";
  select.value = matched;
  custom.style.display = matched === "__custom__" ? "block" : "none";
  custom.value = matched === "__custom__" ? currentModel : "";
  hidden.value = matched === "__custom__" ? currentModel : matched;
}

function onModelModeChange() {
  const select = $("providerModelSelect");
  const custom = $("providerModelCustom");
  const hidden = $("providerModel");
  if (!select || !custom || !hidden) return;

  if (select.value === "__custom__") {
    custom.style.display = "block";
    hidden.value = custom.value.trim();
    custom.focus();
    return;
  }

  custom.style.display = "none";
  hidden.value = select.value;
}

function syncModelHiddenValue() {
  const select = $("providerModelSelect");
  const custom = $("providerModelCustom");
  const hidden = $("providerModel");
  if (!select || !custom || !hidden) return;
  if (select.value === "__custom__") {
    hidden.value = custom.value.trim();
  }
}

function updateOcrSection() {
  const provider = $("ocrProvider").value || "browser";
  const show = (id, visible) => {
    const el = $(id);
    if (el) el.style.display = visible ? "block" : "none";
  };

  show("browserOcrFields", provider === "browser");
  show("ocrSpaceFields", provider === "ocrspace");
  show("baiduOcrFields", provider === "baiduOcr");
  show("customOcrFields", provider === "custom");
}

function syncAiMirrorFromCustomFields() {
  $("aiEndpointMirror").value = $("customTranslateEndpoint").value;
  $("aiPromptMirror").value = extractPromptFromBody($("customTranslateBody").value);
  $("aiApiKeyMirror").value = extractApiKeyFromHeaders($("customTranslateHeaders").value);
  $("aiModelMirror").value = $("providerModel").value || "";
}

function syncAiMirrorToCustomFields() {
  $("customTranslateEndpoint").value = $("aiEndpointMirror").value.trim();
  $("providerEndpoint").value = $("aiEndpointMirror").value.trim();
  $("providerApiKey").value = $("aiApiKeyMirror").value.trim();
  $("providerModel").value = $("aiModelMirror").value.trim();
  $("customTranslateHeaders").value = buildHeadersWithApiKey($("customTranslateHeaders").value, $("aiApiKeyMirror").value.trim());
  $("customTranslateBody").value = buildOpenAiLikeBodyTemplate($("aiModelMirror").value.trim(), $("aiPromptMirror").value);
}

function applyAiTemplate(type) {
  if (type === "claude") {
    $("customTranslateHeaders").value =
      "Content-Type: application/json\nx-api-key: <YOUR_API_KEY>\nanthropic-version: 2023-06-01";
    $("customTranslateBody").value =
      "{\n  \"model\": \"claude-3-5-sonnet-latest\",\n  \"max_tokens\": 1024,\n  \"messages\": [{\"role\": \"user\", \"content\": \"{{text}}\"}]\n}";
    $("customTranslatePath").value = "content.0.text";
  } else {
    $("customTranslateHeaders").value = "Content-Type: application/json\nAuthorization: Bearer <YOUR_API_KEY>";
    $("customTranslateBody").value =
      "{\n  \"model\": \"gpt-4.1-mini\",\n  \"messages\": [{\"role\": \"system\", \"content\": \"{{prompt}}\"}, {\"role\": \"user\", \"content\": \"{{text}}\"}]\n}";
    $("customTranslatePath").value = "choices.0.message.content";
  }
  syncAiMirrorFromCustomFields();
}

function buildOpenAiLikeBodyTemplate(model, prompt) {
  const safeModel = model || "gpt-4.1-mini";
  const safePrompt = (prompt || "Translate from {{sourceLang}} to {{targetLang}}").replace(/"/g, '\\"');
  return `{\n  "model": "${safeModel}",\n  "messages": [{"role": "system", "content": "${safePrompt}"}, {"role": "user", "content": "{{text}}"}]\n}`;
}

function extractPromptFromBody(body) {
  const match = String(body || "").match(/"system"\s*,\s*"content"\s*:\s*"([^"]*)"/);
  return match ? match[1].replace(/\\"/g, "\"") : "Translate from {{sourceLang}} to {{targetLang}}";
}

function extractApiKeyFromHeaders(headers) {
  const raw = String(headers || "");
  const bearer = raw.match(/Authorization:\s*Bearer\s+(.+)/i);
  if (bearer) return bearer[1].trim();
  const xApi = raw.match(/x-api-key:\s*(.+)/i);
  return xApi ? xApi[1].trim() : "";
}

function buildHeadersWithApiKey(headers, apiKey) {
  const base = String(headers || "");
  if (!apiKey) return base;
  if (/Authorization:\s*Bearer/i.test(base)) {
    return base.replace(/Authorization:\s*Bearer\s+.+/i, `Authorization: Bearer ${apiKey}`);
  }
  if (/x-api-key:/i.test(base)) {
    return base.replace(/x-api-key:\s*.+/i, `x-api-key: ${apiKey}`);
  }
  return `${base}\nAuthorization: Bearer ${apiKey}`.trim();
}
