import { getConfig, saveConfig } from "./config.js";

const $ = (id) => document.getElementById(id);

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
}

function collect() {
  return {
    sourceLang: $("sourceLang").value.trim() || "auto",
    targetLang: $("targetLang").value.trim() || "zh-CN",
    translator: {
      provider: $("translatorProvider").value,
      googleEndpoint: "https://translate.googleapis.com/translate_a/single",
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
