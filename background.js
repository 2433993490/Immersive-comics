import { DEFAULT_CONFIG, getConfig } from "./config.js";

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(["comicTranslatorConfig"]);
  if (!existing.comicTranslatorConfig) {
    await chrome.storage.sync.set({ comicTranslatorConfig: DEFAULT_CONFIG });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "PROCESS_IMAGE") {
        const result = await processImage(message.payload);
        sendResponse({ ok: true, result });
        return;
      }
      if (message.type === "OPEN_OPTIONS") {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        return;
      }
      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  })();

  return true;
});

async function processImage({ imageUrl, dataUrl }) {
  const config = await getConfig();
  const ocrBlocks = await runOcr({ config, imageUrl, dataUrl });

  const translatedBlocks = [];
  for (const block of ocrBlocks) {
    const translated = await translateText(block.text, config);
    const refined = config.ai.enabled ? await runAiRefine(translated, config) : translated;
    translatedBlocks.push({ ...block, translated: refined });
  }

  return { blocks: translatedBlocks };
}

async function runOcr({ config, imageUrl, dataUrl }) {
  const provider = config.ocr.provider;
  if (provider === "ocrspace") {
    return runOcrSpace(config, imageUrl);
  }

  if (provider === "custom") {
    return runCustomOcr(config, imageUrl, dataUrl);
  }

  throw new Error(`Unsupported OCR provider: ${provider}`);
}

async function runOcrSpace(config, imageUrl) {
  const body = new FormData();
  body.append("apikey", config.ocr.ocrSpaceApiKey);
  body.append("url", imageUrl);
  body.append("language", "eng");
  body.append("isOverlayRequired", "true");
  body.append("OCREngine", "2");

  const response = await fetch(config.ocr.ocrSpaceEndpoint, {
    method: "POST",
    body
  });
  if (!response.ok) {
    throw new Error(`OCR.Space request failed: ${response.status}`);
  }
  const data = await response.json();
  if (data.IsErroredOnProcessing) {
    throw new Error(data.ErrorMessage?.join(";") || "OCR.Space processing failed");
  }

  const parsed = data.ParsedResults?.[0];
  const lines = parsed?.TextOverlay?.Lines || [];
  return lines
    .map((line) => {
      const words = line.Words || [];
      const left = Math.min(...words.map((w) => w.Left), line.MinTop || 0);
      const top = Math.min(...words.map((w) => w.Top), line.MinTop || 0);
      const right = Math.max(...words.map((w) => w.Left + w.Width), line.MaxHeight || 0);
      const bottom = Math.max(...words.map((w) => w.Top + w.Height), line.MinTop + line.MaxHeight || 0);

      return {
        text: (line.LineText || "").trim(),
        box: {
          x: left,
          y: top,
          width: Math.max(42, right - left),
          height: Math.max(22, bottom - top)
        }
      };
    })
    .filter((item) => item.text.length > 0);
}

async function runCustomOcr(config, imageUrl, dataUrl) {
  const endpoint = config.ocr.custom.endpoint;
  if (!endpoint) {
    throw new Error("Custom OCR endpoint is empty");
  }

  const payload = applyTemplate(config.ocr.custom.bodyTemplate, {
    imageBase64: stripDataUrlPrefix(dataUrl),
    imageUrl
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: parseHeaders(config.ocr.custom.headers),
    body: payload
  });

  if (!response.ok) {
    throw new Error(`Custom OCR request failed: ${response.status}`);
  }

  const data = await response.json();
  const lines = getByPath(data, config.ocr.custom.responsePath);

  if (!Array.isArray(lines)) {
    throw new Error("Custom OCR responsePath must resolve to an array of {text, box}");
  }

  return lines.filter((line) => line?.text && line?.box).map(normalizeLine);
}

function normalizeLine(line) {
  return {
    text: String(line.text),
    box: {
      x: Number(line.box.x || 0),
      y: Number(line.box.y || 0),
      width: Number(line.box.width || 42),
      height: Number(line.box.height || 22)
    }
  };
}

async function translateText(text, config) {
  if (!text) return "";
  const provider = config.translator.provider;

  if (provider === "google") {
    const q = new URLSearchParams({
      client: "gtx",
      sl: config.sourceLang || "auto",
      tl: config.targetLang || "zh-CN",
      dt: "t",
      q: text
    });

    const response = await fetch(`${config.translator.endpoint}?${q.toString()}`);
    const data = await mustJson(response, "Google translate");
    return (data?.[0] || []).map((part) => part?.[0] || "").join("").trim();
  }

  if (["deepseek", "azure_openai", "bailian", "qwen_mt", "doubao"].includes(provider)) {
    return callOpenAiCompatible(text, config);
  }

  if (provider === "claude") {
    return callClaude(text, config);
  }

  if (provider === "deepl") {
    return callDeepL(text, config);
  }

  if (provider === "gemini") {
    return callGemini(text, config);
  }

  if (provider === "openl") {
    return callOpenL(text, config);
  }

  if (provider === "azure_translator") {
    return callAzureTranslator(text, config);
  }

  if (["baidu_fanyi", "caiyun", "volcengine", "qq_transmart", "niutrans", "youdao", "youdao_llm", "aliyun_translate", "baidu_qianfan", "custom"].includes(provider)) {
    return callCustomTemplateProvider(text, config);
  }

  throw new Error(`Unsupported translator provider: ${provider}`);
}

async function callOpenAiCompatible(text, config) {
  const prompt = `Translate into ${config.targetLang}. Return only translation:\n${text}`;
  const response = await fetch(config.translator.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.translator.apiKey}`,
      ...parseHeaders(config.translator.customHeaders)
    },
    body: JSON.stringify({
      model: config.translator.model || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });
  const data = await mustJson(response, "OpenAI-compatible translate");
  return data?.choices?.[0]?.message?.content?.trim() || text;
}

async function callClaude(text, config) {
  const response = await fetch(config.translator.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.translator.apiKey,
      "anthropic-version": "2023-06-01",
      ...parseHeaders(config.translator.customHeaders)
    },
    body: JSON.stringify({
      model: config.translator.model || "claude-3-5-sonnet-latest",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Translate into ${config.targetLang}. Return only translation:\n${text}`
        }
      ]
    })
  });
  const data = await mustJson(response, "Claude translate");
  return data?.content?.[0]?.text?.trim() || text;
}

async function callDeepL(text, config) {
  const form = new URLSearchParams({
    text,
    target_lang: normalizeDeepLTarget(config.targetLang),
    source_lang: normalizeDeepLSource(config.sourceLang)
  });
  const response = await fetch(config.translator.endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${config.translator.apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...parseHeaders(config.translator.customHeaders)
    },
    body: form.toString()
  });
  const data = await mustJson(response, "DeepL translate");
  return data?.translations?.[0]?.text?.trim() || text;
}

async function callGemini(text, config) {
  const endpoint = applyTemplate(config.translator.endpoint, {
    model: config.translator.model || "gemini-1.5-flash",
    key: config.translator.apiKey
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...parseHeaders(config.translator.customHeaders)
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: `Translate into ${config.targetLang}. Return only translation:\n${text}` }]
        }
      ]
    })
  });
  const data = await mustJson(response, "Gemini translate");
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
}

async function callOpenL(text, config) {
  const endpoint = applyTemplate(config.translator.endpoint, {
    codename: config.translator.codename || "google"
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.translator.apiKey ? `Bearer ${config.translator.apiKey}` : "",
      ...parseHeaders(config.translator.customHeaders)
    },
    body: JSON.stringify({
      text,
      source_lang: config.sourceLang,
      target_lang: config.targetLang
    })
  });
  const data = await mustJson(response, "OpenL translate");
  return data?.translatedText || data?.translation || data?.data?.translation || text;
}

async function callAzureTranslator(text, config) {
  const endpoint = new URL(config.translator.endpoint);
  endpoint.searchParams.set("api-version", "3.0");
  endpoint.searchParams.set("from", config.sourceLang === "auto" ? "en" : config.sourceLang);
  endpoint.searchParams.set("to", config.targetLang);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": config.translator.apiKey,
      ...(config.translator.region ? { "Ocp-Apim-Subscription-Region": config.translator.region } : {}),
      ...parseHeaders(config.translator.customHeaders)
    },
    body: JSON.stringify([{ Text: text }])
  });
  const data = await mustJson(response, "Azure translator");
  return data?.[0]?.translations?.[0]?.text || text;
}

async function callCustomTemplateProvider(text, config) {
  const endpoint = applyTemplate(config.translator.endpoint, {
    model: config.translator.model,
    key: config.translator.apiKey,
    service: config.translator.service,
    paramsString: config.translator.paramsString,
    codename: config.translator.codename
  });

  if (!endpoint) {
    throw new Error("当前翻译服务未配置 endpoint");
  }

  const payload = applyTemplate(config.translator.customBodyTemplate, {
    text,
    sourceLang: config.sourceLang,
    targetLang: config.targetLang,
    model: config.translator.model,
    key: config.translator.apiKey
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...parseHeaders(config.translator.customHeaders),
      ...(config.translator.apiKey ? { Authorization: `Bearer ${config.translator.apiKey}` } : {})
    },
    body: payload
  });
  const data = await mustJson(response, `${config.translator.provider} translate`);
  const translated = getByPath(data, config.translator.customResponsePath);
  return translated ? String(translated).trim() : text;
}

async function runAiRefine(text, config) {
  const endpoint = config.ai.endpoint;
  if (!endpoint) return text;

  const prompt = applyTemplate(config.ai.promptTemplate, { text });
  const payload = applyTemplate(config.ai.bodyTemplate, {
    model: config.ai.model,
    prompt,
    text
  });

  const headers = {
    ...parseHeaders(config.ai.headers),
    ...(config.ai.apiKey ? { Authorization: `Bearer ${config.ai.apiKey}` } : {})
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: payload
  });

  if (!response.ok) {
    return text;
  }

  const data = await response.json();
  const refined = getByPath(data, config.ai.responsePath);
  return refined ? String(refined).trim() : text;
}

async function mustJson(response, tag) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${tag} failed: ${response.status} ${body.slice(0, 260)}`);
  }
  return response.json();
}

function normalizeDeepLTarget(value) {
  return String(value || "ZH").replace("zh-CN", "ZH").replace("zh-TW", "ZH").toUpperCase();
}

function normalizeDeepLSource(value) {
  if (!value || value === "auto") return "EN";
  return String(value).toUpperCase();
}

function parseHeaders(raw) {
  const headers = {};
  String(raw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && value) headers[key] = value;
    });

  return headers;
}

function applyTemplate(template, vars) {
  return String(template || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    return vars[key] ?? "";
  });
}

function getByPath(obj, path) {
  if (!path) return undefined;
  return path.split(".").reduce((acc, part) => {
    if (acc == null) return undefined;
    if (/^\d+$/.test(part)) return acc[Number(part)];
    return acc[part];
  }, obj);
}

function stripDataUrlPrefix(dataUrl) {
  return String(dataUrl || "").replace(/^data:.+;base64,/, "");
}
