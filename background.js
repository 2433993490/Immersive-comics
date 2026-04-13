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
  return lines.map((line) => {
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
  }).filter((item) => item.text.length > 0);
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

  return lines
    .filter((line) => line?.text && line?.box)
    .map((line) => ({
      text: String(line.text),
      box: {
        x: Number(line.box.x || 0),
        y: Number(line.box.y || 0),
        width: Number(line.box.width || 42),
        height: Number(line.box.height || 22)
      }
    }));
}

async function translateText(text, config) {
  if (!text) return "";

  if (config.translator.provider === "google") {
    const q = new URLSearchParams({
      client: "gtx",
      sl: config.sourceLang || "auto",
      tl: config.targetLang || "zh-CN",
      dt: "t",
      q: text
    });

    const response = await fetch(`${config.translator.googleEndpoint}?${q.toString()}`);
    if (!response.ok) {
      throw new Error(`Google translate request failed: ${response.status}`);
    }

    const data = await response.json();
    return (data?.[0] || []).map((part) => part?.[0] || "").join("").trim();
  }

  if (config.translator.provider === "azureTranslator") {
    const source = config.sourceLang && config.sourceLang !== "auto" ? config.sourceLang : "auto-detect";
    const target = config.targetLang || "zh-Hans";
    const endpoint = `${config.translator.azureTranslatorEndpoint}&from=${encodeURIComponent(source)}&to=${encodeURIComponent(target)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify([{ Text: text }])
    });

    if (!response.ok) {
      throw new Error(`Microsoft translate request failed: ${response.status}`);
    }

    const data = await response.json();
    return String(data?.[0]?.translations?.[0]?.text || "").trim();
  }

  if (config.translator.provider !== "google") {
    const endpoint = config.translator.custom.endpoint;
    if (!endpoint) {
      throw new Error("Custom translator endpoint is empty");
    }

    const payload = applyTemplate(config.translator.custom.bodyTemplate, {
      text,
      sourceLang: config.sourceLang || "auto",
      targetLang: config.targetLang || "zh-CN"
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: parseHeaders(config.translator.custom.headers),
      body: payload
    });

    if (!response.ok) {
      throw new Error(`Translator request failed: ${response.status}`);
    }

    const data = await response.json();
    const translated = getByPath(data, config.translator.custom.responsePath);
    if (!translated) {
      throw new Error("Translator responsePath produced empty result");
    }

    return String(translated);
  }

  throw new Error(`Unsupported translator provider: ${config.translator.provider}`);
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
      if (key) headers[key] = value;
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
