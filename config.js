export const DEFAULT_CONFIG = {
  targetLang: "zh-CN",
  sourceLang: "auto",
  translator: {
    provider: "tencentTransmart",
    googleEndpoint: "https://translate.googleapis.com/translate_a/single",
    azureTranslatorEndpoint: "https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0",
    providerConfigs: {},
    custom: {
      endpoint: "",
      headers: "Content-Type: application/json",
      bodyTemplate: "{\n  \"text\": \"{{text}}\",\n  \"target\": \"{{targetLang}}\"\n}",
      responsePath: "data.translation"
    }
  },
  ocr: {
    provider: "browser",
    ocrSpaceEndpoint: "https://api.ocr.space/parse/image",
    ocrSpaceApiKey: "helloworld",
    baiduOcrEndpoint: "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic",
    baiduOcrAccessToken: "",
    baiduOcrApiKey: "",
    baiduOcrSecretKey: "",
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
