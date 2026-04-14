const state = {
  images: new Set()
};
const SUPPORTED_MANGA_SITE_KEYWORDS = [
  "pixiv",
  "mangaplus",
  "zebrack",
  "comic-fuz",
  "mangadex",
  "yamibo",
  "shonenjumpplus",
  "rimacomiplus",
  "heros-web",
  "comic-days",
  "comic-top",
  "comic-walker",
  "web-ace",
  "antbyw",
  "jmanga",
  "twitter",
  "mangaz",
  "pash-up",
  "colamanga",
  "ganganonline",
  "batoto",
  "asurascans",
  "allmanga",
  "manhwaclan",
  "corocoro",
  "tonarinoyj",
  "yymanhua",
  "manhwatop",
  "palcy",
  "comic-trail",
  "templetoons",
  "batocomic",
  "comic-action",
  "ac.qq.com",
  "sololeveling",
  "syosetu",
  "comick",
  "younganimal",
  "piccoma",
  "hentaizap",
  "hanime1",
  "globalcomix",
  "xbato",
  "mangaraw",
  "bilibili",
  "idmzj",
  "animatebookstore",
  "ganma",
  "mangafire",
  "reaperscans",
  "dlsite",
  "shonenmagazine",
  "comic.naver",
  "webtoons",
  "lezhin",
  "rawkuma",
  "kakao",
  "topreadmanga",
  "poipiku",
  "manhuaus",
  "hmttmh",
  "comic-growl",
  "jumptoon",
  "fenoxo",
  "mangafreak",
  "cmoa",
  "comicgardo",
  "booklive",
  "mrblue",
  "mangalove"
];
const SITE_ADAPTERS = {
  twitter: ["article img", "img[src*='twimg']"],
  pixiv: ["figure img", "img[alt*='漫画']", "img"],
  mangaplus: [".page img", "img[src*='manga']"],
  mangadex: [".reader--image img", ".md--reader-chapter img"],
  bilibili: [".manga-image img", ".image-container img"]
};
const DEFAULT_IMAGE_SELECTORS = [
  "main img",
  ".viewer img",
  ".reader img",
  ".comic img",
  "article img",
  "img"
];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SCAN_IMAGES") {
    const count = attachButtonsToEligibleImages();
    sendResponse({ ok: true, count });
    return;
  }

  if (message.type === "CLEAR_OVERLAYS") {
    clearAllOverlays();
    sendResponse({ ok: true });
  }
});

attachButtonsToEligibleImages();

function attachButtonsToEligibleImages() {
  if (!isSupportedMangaSite(location.hostname)) {
    return 0;
  }

  let count = 0;
  const images = collectSiteImages();
  for (const img of images) {
    if (!isEligibleImage(img)) continue;
    if (state.images.has(img)) continue;

    const btn = createButton(img);
    document.body.appendChild(btn);
    placeButton(img, btn);

    const ro = new ResizeObserver(() => placeButton(img, btn));
    ro.observe(img);
    window.addEventListener("scroll", () => placeButton(img, btn), { passive: true });
    window.addEventListener("resize", () => placeButton(img, btn), { passive: true });

    state.images.add(img);
    count += 1;
  }

  return count;
}

function isEligibleImage(img) {
  const rect = img.getBoundingClientRect();
  const src = img.currentSrc || img.src || img.dataset?.src || "";
  return rect.width >= 220 && rect.height >= 220 && src && !src.startsWith("data:");
}

function createButton(img) {
  const btn = document.createElement("button");
  btn.className = "comic-translate-btn";
  btn.textContent = "翻译漫画";

  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    btn.disabled = true;
    btn.classList.add("comic-translate-loading");
    const previous = btn.textContent;
    btn.textContent = "翻译中...";

    try {
      const imageUrl = img.currentSrc || img.src;
      const dataUrl = await getImageDataUrl(img, imageUrl);
      const browserOcrBlocks = await detectTextBlocksWithBrowser(img);
      const response = await chrome.runtime.sendMessage({
        type: "PROCESS_IMAGE",
        payload: {
          imageUrl,
          dataUrl,
          browserOcrBlocks
        }
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Unknown processing error");
      }

      renderOverlay(img, response.result.blocks || [], response.result.ui || {});
      btn.textContent = "已翻译";
    } catch (error) {
      const reason = formatErrorMessage(error);
      btn.textContent = reason;
      btn.title = reason;
      console.error("Comic translator error", error);
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.classList.remove("comic-translate-loading");
        btn.title = "";
        if (btn.textContent === "已翻译") {
          btn.textContent = previous;
        } else if (btn.textContent !== previous) {
          btn.textContent = "翻译漫画";
        }
      }, 1500);
    }
  });

  return btn;
}

function placeButton(img, btn) {
  const rect = img.getBoundingClientRect();
  const x = window.scrollX + rect.left + 8;
  const y = window.scrollY + rect.top + 8;
  btn.style.left = `${x}px`;
  btn.style.top = `${y}px`;
}

function renderOverlay(img, blocks, uiConfig = {}) {
  removeOverlayForImage(img);

  const imgRect = img.getBoundingClientRect();
  const naturalWidth = img.naturalWidth || imgRect.width;
  const naturalHeight = img.naturalHeight || imgRect.height;

  const overlay = document.createElement("div");
  overlay.className = "comic-translate-overlay";
  overlay.dataset.overlayMode = uiConfig.overlayMode || "immersive";
  overlay.dataset.targetImage = img.currentSrc || img.src;
  overlay.style.left = `${window.scrollX + imgRect.left}px`;
  overlay.style.top = `${window.scrollY + imgRect.top}px`;
  overlay.style.width = `${imgRect.width}px`;
  overlay.style.height = `${imgRect.height}px`;

  for (const block of blocks) {
    const translatedText = String(block.translated || "").trim();
    if (!translatedText) continue;

    const bubble = document.createElement("div");
    bubble.className = "comic-translate-bubble";
    bubble.textContent = translatedText;
    bubble.title = `点击复制\n原文：${String(block.text || "").trim()}`;

    const scaleX = imgRect.width / naturalWidth;
    const scaleY = imgRect.height / naturalHeight;
    const rawWidth = Math.max(46, block.box.width * scaleX);
    const rawHeight = Math.max(24, block.box.height * scaleY);
    const width = Math.max(48, rawWidth + 2);
    const height = Math.max(24, rawHeight + 2);

    bubble.style.left = `${block.box.x * scaleX}px`;
    bubble.style.top = `${block.box.y * scaleY}px`;
    bubble.style.width = `${width}px`;
    bubble.style.minHeight = `${height}px`;
    bubble.style.fontSize = `${getAdaptiveFontSize(width, height, translatedText)}px`;

    bubble.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(bubble.textContent || "");
      } catch (err) {
        console.debug("clipboard write failed", err);
      }
    });

    overlay.appendChild(bubble);
  }

  document.body.appendChild(overlay);

  const updater = () => {
    const rect = img.getBoundingClientRect();
    overlay.style.left = `${window.scrollX + rect.left}px`;
    overlay.style.top = `${window.scrollY + rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  };

  window.addEventListener("scroll", updater, { passive: true });
  window.addEventListener("resize", updater, { passive: true });
}

function getAdaptiveFontSize(width, height, text) {
  const safeText = String(text || "").trim();
  if (!safeText) return 12;
  const baseByHeight = Math.max(11, Math.min(28, Math.floor(height * 0.58)));
  const estimatedPerLine = Math.max(2, Math.floor(width / Math.max(8, baseByHeight * 0.56)));
  const estimatedLines = Math.max(1, Math.ceil(safeText.length / estimatedPerLine));
  const fitByLines = Math.floor((height - 6) / estimatedLines);
  return Math.max(11, Math.min(baseByHeight, fitByLines));
}

function removeOverlayForImage(img) {
  const key = img.currentSrc || img.src;
  const old = document.querySelector(`.comic-translate-overlay[data-target-image="${CSS.escape(key)}"]`);
  if (old) old.remove();
}

function clearAllOverlays() {
  document.querySelectorAll(".comic-translate-overlay").forEach((node) => node.remove());
}

function imageToDataUrl(img) {
  return new Promise((resolve, reject) => {
    if (!img.naturalWidth || !img.naturalHeight) {
      reject(new Error("Image is not ready"));
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Cannot get canvas context"));
      return;
    }

    try {
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    } catch (error) {
      reject(new Error(`Image to canvas failed (${error?.message || "CORS?"})`));
    }
  });
}

async function getImageDataUrl(img, imageUrl) {
  try {
    return await imageToDataUrl(img);
  } catch (error) {
    const fallback = await chrome.runtime.sendMessage({
      type: "FETCH_IMAGE_DATA_URL",
      payload: {
        imageUrl,
        pageUrl: location.href
      }
    });
    if (!fallback?.ok || !fallback?.dataUrl) {
      throw error;
    }
    return fallback.dataUrl;
  }
}

function formatErrorMessage(error) {
  const message = String(error?.message || "未知错误").trim();
  if (!message) return "失败：未知错误";
  const shortMessage = message.length > 24 ? `${message.slice(0, 24)}…` : message;
  return `失败：${shortMessage}`;
}

async function detectTextBlocksWithBrowser(img) {
  if (typeof TextDetector === "undefined") return null;
  try {
    const detector = new TextDetector();
    const results = await detector.detect(img);
    return results
      .map((item) => ({
        text: String(item?.rawValue || "").trim(),
        box: {
          x: Number(item?.boundingBox?.x || 0),
          y: Number(item?.boundingBox?.y || 0),
          width: Number(item?.boundingBox?.width || 42),
          height: Number(item?.boundingBox?.height || 22)
        }
      }))
      .filter((line) => line.text.length > 0);
  } catch (error) {
    console.debug("browser OCR failed", error);
    return null;
  }
}

function isSupportedMangaSite(hostname) {
  const host = String(hostname || "").toLowerCase();
  return SUPPORTED_MANGA_SITE_KEYWORDS.some((keyword) => host.includes(keyword));
}

function collectSiteImages() {
  const host = String(location.hostname || "").toLowerCase();
  const selectors = getSelectorsForHost(host);
  const unique = new Set();
  const images = [];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (!(node instanceof HTMLImageElement)) return;
      if (unique.has(node)) return;
      unique.add(node);
      images.push(node);
    });
  });
  return images;
}

function getSelectorsForHost(host) {
  for (const [keyword, selectors] of Object.entries(SITE_ADAPTERS)) {
    if (host.includes(keyword)) return selectors;
  }
  return DEFAULT_IMAGE_SELECTORS;
}
