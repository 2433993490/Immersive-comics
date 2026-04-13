import { getConfig, saveConfig, TRANSLATOR_PROVIDER_OPTIONS } from "./config.js";

const $ = (id) => document.getElementById(id);

init();

async function init() {
  hydrateProviderSelect();
  const config = await getConfig();
  bind(config);

  $("translatorProvider")?.addEventListener("change", () => {
    const provider = $("translatorProvider").value;
    const def = TRANSLATOR_PROVIDER_OPTIONS.find((item) => item.value === provider);
    if (def?.endpoint) {
      $("translatorEndpoint").value = def.endpoint;
    }
    $("providerTip").textContent = def ? `${def.label} 默认接口：${def.endpoint || "请自定义"}` : "";
  });

  $("saveBtn")?.addEventListener("click", async () => {
    const next = collect();
    await saveConfig(next);
    const msg = $("msg");
    msg.textContent = "已保存";
    setTimeout(() => (msg.textContent = ""), 1800);
  });
}

function hydrateProviderSelect() {
  const node = $("translatorProvider");
  node.innerHTML = "";
  for (const item of TRANSLATOR_PROVIDER_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = item.value;
    opt.textContent = item.label;
    node.appendChild(opt);
  }
}

function bind(config) {
  $("sourceLang").value = config.sourceLang;
  $("targetLang").value = config.targetLang;

  $("translatorProvider").value = config.translator.provider;
  $("translatorEndpoint").value = config.translator.endpoint;
  $("translatorApiKey").value = config.translator.apiKey;
  $("translatorApiSecret").value = config.translator.apiSecret;
  $("translatorModel").value = config.translator.model;
  $("translatorRegion").value = config.translator.region;
  $("translatorService").value = config.translator.service;
  $("translatorCodename").value = config.translator.codename;
  $("translatorParams").value = config.translator.paramsString;
  $("customTranslateHeaders").value = config.translator.customHeaders;
  $("customTranslateBody").value = config.translator.customBodyTemplate;
  $("customTranslatePath").value = config.translator.customResponsePath;

  const def = TRANSLATOR_PROVIDER_OPTIONS.find((item) => item.value === config.translator.provider);
  $("providerTip").textContent = def ? `${def.label} 默认接口：${def.endpoint || "请自定义"}` : "";

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
      endpoint: $("translatorEndpoint").value.trim(),
      apiKey: $("translatorApiKey").value.trim(),
      apiSecret: $("translatorApiSecret").value.trim(),
      model: $("translatorModel").value.trim(),
      service: $("translatorService").value.trim(),
      paramsString: $("translatorParams").value.trim(),
      codename: $("translatorCodename").value.trim() || "google",
      region: $("translatorRegion").value.trim(),
      customHeaders: $("customTranslateHeaders").value,
      customBodyTemplate: $("customTranslateBody").value,
      customResponsePath: $("customTranslatePath").value.trim()
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
