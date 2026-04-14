import { DEFAULT_CONFIG, getConfig } from "./config.js";

const baiduOcrTokenCache = new Map();

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
      if (message.type === "FETCH_IMAGE_DATA_URL") {
        const dataUrl = await fetchImageAsDataUrl(message.payload);
        sendResponse({ ok: true, dataUrl });
        return;
      }
      if (message.type === "OPEN_OPTIONS") {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "TEST_TRANSLATOR") {
        const result = await translateText("Hello world", message.payload.config || (await getConfig()));
        sendResponse({ ok: true, result });
        return;
      }
      if (message.type === "TEST_OCR") {
        const config = message.payload.config || (await getConfig());
        const testDataUrl =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
        const result = await runOcr({
          config,
          imageUrl: "https://example.com/test.png",
          dataUrl: testDataUrl,
          testMode: true
        });
        sendResponse({ ok: true, result: { count: result.length } });
        return;
      }
      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  })();

  return true;
});

async function processImage({ imageUrl, dataUrl, browserOcrBlocks }) {
  const config = await getConfig();
  let ocrBlocks = [];
  if (config.ocr.provider === "browser") {
    ocrBlocks = Array.isArray(browserOcrBlocks) ? browserOcrBlocks : [];
    if (!ocrBlocks.length) {
      throw new Error("浏览器 OCR 仅支持 Chrome / Edge，请切换 OCR.Space 或其它 OCR 源");
    }
  } else {
    ocrBlocks = await runOcr({ config, imageUrl, dataUrl });
  }
  const translatedTexts = await translateBlocksWithContext(ocrBlocks, config);
  const translatedBlocks = ocrBlocks.map((block, idx) => ({
    ...block,
    translated: translatedTexts[idx] || ""
  }));

  return {
    blocks: translatedBlocks,
    ui: {
      overlayMode: config?.ui?.overlayMode || "immersive",
      translationMode: config?.ui?.translationMode || "standard"
    }
  };
}

async function runOcr({ config, imageUrl, dataUrl, testMode = false }) {
  const provider = config.ocr.provider;
  if (provider === "browser") {
    return runOcrSpace(config, { imageUrl, dataUrl });
  }
  if (provider === "ocrspace") {
    return runOcrSpace(config, { imageUrl, dataUrl });
  }

  if (provider === "custom") {
    return runCustomOcr(config, imageUrl, dataUrl);
  }
  if (provider === "baiduOcr") {
    return runBaiduOcr(config, dataUrl, { testMode });
  }

  throw new Error(`Unsupported OCR provider: ${provider}`);
}

async function runOcrSpace(config, { imageUrl, dataUrl }) {
  const body = new FormData();
  body.append("apikey", config.ocr.ocrSpaceApiKey);
  if (dataUrl) {
    body.append("base64Image", dataUrl);
  } else {
    body.append("url", imageUrl);
  }
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

async function runBaiduOcr(config, dataUrl, { testMode = false } = {}) {
  const token = await resolveBaiduOcrAccessToken(config);
  if (!token) {
    throw new Error("Baidu OCR access token is empty (or API Key/Secret Key is missing)");
  }

  const endpoint = config.ocr.baiduOcrEndpoint || "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic";
  const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const body = new URLSearchParams({
    image: stripDataUrlPrefix(dataUrl)
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Baidu OCR request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.error_code) {
    if (testMode && [216201, 216202, 216630].includes(Number(data.error_code))) {
      return [];
    }
    throw new Error(data.error_msg || `Baidu OCR error: ${data.error_code}`);
  }

  const lines = Array.isArray(data.words_result) ? data.words_result : [];
  return lines
    .map((item, index) => ({
      text: String(item.words || "").trim(),
      box: {
        x: 8,
        y: 8 + index * 26,
        width: 320,
        height: 24
      }
    }))
    .filter((line) => line.text.length > 0);
}

async function resolveBaiduOcrAccessToken(config) {
  const directToken = String(config?.ocr?.baiduOcrAccessToken || "").trim();
  if (directToken) return directToken;

  const apiKey = String(config?.ocr?.baiduOcrApiKey || "").trim();
  const secretKey = String(config?.ocr?.baiduOcrSecretKey || "").trim();
  if (!apiKey || !secretKey) return "";

  const cacheKey = `${apiKey}:${secretKey}`;
  const now = Date.now();
  const cached = baiduOcrTokenCache.get(cacheKey);
  if (cached && cached.expireAt > now) {
    return cached.token;
  }

  const tokenUrl = new URL("https://aip.baidubce.com/oauth/2.0/token");
  tokenUrl.searchParams.set("grant_type", "client_credentials");
  tokenUrl.searchParams.set("client_id", apiKey);
  tokenUrl.searchParams.set("client_secret", secretKey);
  const response = await fetch(tokenUrl.toString(), { method: "POST" });
  if (!response.ok) {
    throw new Error(`Baidu OCR token request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.access_token) {
    throw new Error(data?.error_description || "Baidu OCR token response missing access_token");
  }

  const expiresInSec = Number(data.expires_in || 0);
  const safeExpireAt = now + Math.max(60, expiresInSec - 60) * 1000;
  baiduOcrTokenCache.set(cacheKey, {
    token: data.access_token,
    expireAt: safeExpireAt
  });
  return data.access_token;
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
    const providerConfig = config.translator.providerConfigs?.[config.translator.provider];
    const requestConfig = buildTranslatorRequestConfig({ config, providerConfig, text });
    const response = await fetch(requestConfig.endpoint, {
      method: "POST",
      headers: requestConfig.headers,
      body: requestConfig.payload
    });

    if (!response.ok) {
      throw new Error(`Translator request failed: ${response.status}`);
    }

    const data = await response.json();
    const translated = getByPath(data, requestConfig.responsePath);
    if (!translated) {
      throw new Error("Translator responsePath produced empty result");
    }

    return String(translated);
  }

  throw new Error(`Unsupported translator provider: ${config.translator.provider}`);
}

function buildTranslatorRequestConfig({ config, providerConfig, text }) {
  const provider = config.translator.provider;
  const endpointTemplate = providerConfig?.endpoint || config.translator.custom.endpoint;
  if (!endpointTemplate) {
    throw new Error("Custom translator endpoint is empty");
  }
  const apiKey = providerConfig?.apiKey || "";
  const model = providerConfig?.model || "";

  const vars = {
    text,
    sourceLang: config.sourceLang || "auto",
    targetLang: config.targetLang || "zh-CN",
    key: encodeURIComponent(apiKey),
    model
  };
  const endpoint = applyBraceTemplate(endpointTemplate, vars);
  const payload = applyTemplate(providerConfig?.bodyTemplate || config.translator.custom.bodyTemplate, vars);

  if ((provider === "gemini" || provider === "baiduQianfan") && !apiKey) {
    throw new Error(`${provider} 平台需要填写 API Key/access token`);
  }
  if ((provider === "gemini" || provider === "baiduQianfan" || provider === "doubao" || provider === "openl") && !model) {
    throw new Error(`${provider} 平台需要填写模型名称或服务代号`);
  }

  return {
    endpoint,
    payload,
    headers: parseHeaders(providerConfig?.headers || config.translator.custom.headers),
    responsePath: providerConfig?.responsePath || config.translator.custom.responsePath
  };
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

function applyBraceTemplate(template, vars) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
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

async function fetchImageAsDataUrl({ imageUrl, pageUrl }) {
  if (!imageUrl) throw new Error("imageUrl is required");
  const parsed = new URL(imageUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP/HTTPS image URLs are supported");
  }
  const response = await fetch(imageUrl, {
    credentials: "include",
    referrer: pageUrl || undefined
  });
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error(`Unexpected content-type: ${contentType}`);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  const maxImageSize = 15 * 1024 * 1024;
  if (contentLength > maxImageSize) {
    throw new Error("Image is too large to process");
  }
  const blob = await response.blob();
  if (blob.size > maxImageSize) {
    throw new Error("Image is too large to process");
  }
  return blobToDataUrl(blob);
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  const mime = blob.type || "image/png";
  return `data:${mime};base64,${base64}`;
}

async function translateBlocksWithContext(blocks, config) {
  if (!blocks.length) return [];
  const requestedMode = config?.ui?.translationMode || "standard";
  const mode = requestedMode === "aiExpert" && isAiExpertSupportedProvider(config?.translator?.provider)
    ? "aiExpert"
    : "standard";

  if (blocks.length === 1) {
    if (mode === "aiExpert") {
      const singlePrompt = buildAiExpertPrompt(`[1] ${blocks[0].text}`, config);
      const singleResult = await translateText(singlePrompt, config);
      const singleParsed = parseIndexedTranslations(singleResult, 1);
      if (singleParsed.length === 1) return singleParsed;
    }
    return [await translateText(blocks[0].text, config)];
  }

  const markerLines = blocks.map((block, idx) => `[${idx + 1}] ${block.text}`);
  const mergedRaw = markerLines.join("\n");
  const merged = mode === "aiExpert" ? buildAiExpertPrompt(mergedRaw, config) : mergedRaw;
  const mergedTranslated = await translateText(merged, config);
  const parsed = parseIndexedTranslations(mergedTranslated, blocks.length);
  if (parsed.length === blocks.length) return parsed;

  const translatedBlocks = [];
  for (const block of blocks) {
    translatedBlocks.push(await translateText(block.text, config));
  }
  return translatedBlocks;
}

function isAiExpertSupportedProvider(provider) {
  return new Set([
    "claude",
    "deepseek",
    "gemini",
    "azureOpenai",
    "aliyunBailian",
    "qwenMt",
    "baiduQianfan",
    "doubao",
    "youdaoLlm",
    "openl",
    "custom"
  ]).has(provider);
}

function buildAiExpertPrompt(indexedText, config) {
  const sourceLang = config?.sourceLang || "auto";
  const targetLang = config?.targetLang || "zh-CN";
  const expert = config?.ui?.aiExpert || "general";
  const strategy = getAiExpertStrategy(expert);
  return [
    `你是“沉浸式翻译 AI 专家”，请把以下漫画 OCR 文本从 ${sourceLang} 翻译到 ${targetLang}。`,
    `当前专家：${strategy.name}`,
    "要求：",
    "1) 保留每一行开头的 [序号]，禁止遗漏编号。",
    "2) 用口语化、自然、贴近漫画语气的翻译。",
    "3) 只输出翻译结果，不要解释。",
    `4) 专家策略：${strategy.prompt}`,
    "",
    indexedText
  ].join("\n");
}

function getAiExpertStrategy(expert) {
  const map = {
    general: {
      name: "通用",
      prompt: "保持语义准确与可读性平衡，适合大多数场景。"
    },
    manga: {
      name: "漫画对白强化",
      prompt: "优先体现角色语气、情绪与口语节奏，短句更自然。"
    },
    technical: {
      name: "技术文档",
      prompt: "术语统一、表达精确，保留关键英文术语和专有名词。"
    },
    news: {
      name: "新闻资讯",
      prompt: "风格客观简洁，优先传达事实与时间、数字信息。"
    },
    github: {
      name: "GitHub 代码注释",
      prompt: "代码块与变量名保持原样，注释与说明翻译清晰凝练。"
    }
  };
  return map[expert] || map.general;
}

function parseIndexedTranslations(text, expectedCount) {
  const result = new Array(expectedCount).fill("");
  const regex = /^\s*\[(\d+)\]\s*(.+)$/gm;
  let match = regex.exec(text);
  while (match) {
    const index = Number(match[1]) - 1;
    if (index >= 0 && index < expectedCount) {
      result[index] = match[2].trim();
    }
    match = regex.exec(text);
  }
  return result.filter(Boolean).length === expectedCount ? result : [];
}
