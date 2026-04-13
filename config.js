export const DEFAULT_CONFIG = {
  targetLang: "zh-CN",
  sourceLang: "auto",
  translator: {
    provider: "google",
    googleEndpoint: "https://translate.googleapis.com/translate_a/single",
    azureTranslatorEndpoint: "https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0",
    custom: {
      endpoint: "",
      headers: "Content-Type: application/json",
      bodyTemplate: "{\n  \"text\": \"{{text}}\",\n  \"target\": \"{{targetLang}}\"\n}",
      responsePath: "data.translation"
    }
  },
  ai: {
    enabled: false,
    expert: "general",
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
