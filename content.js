const state = {
  images: new Set()
};

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
  let count = 0;
  const images = Array.from(document.querySelectorAll("img"));
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
  return rect.width >= 280 && rect.height >= 280 && img.src && !img.src.startsWith("data:");
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

      renderOverlay(img, response.result.blocks || []);
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

function renderOverlay(img, blocks) {
  removeOverlayForImage(img);

  const imgRect = img.getBoundingClientRect();
  const naturalWidth = img.naturalWidth || imgRect.width;
  const naturalHeight = img.naturalHeight || imgRect.height;

  const overlay = document.createElement("div");
  overlay.className = "comic-translate-overlay";
  overlay.dataset.targetImage = img.currentSrc || img.src;
  overlay.style.left = `${window.scrollX + imgRect.left}px`;
  overlay.style.top = `${window.scrollY + imgRect.top}px`;
  overlay.style.width = `${imgRect.width}px`;
  overlay.style.height = `${imgRect.height}px`;

  for (const block of blocks) {
    const bubble = document.createElement("div");
    bubble.className = "comic-translate-bubble";
    bubble.textContent = block.translated || "";
    bubble.title = "点击复制";

    const scaleX = imgRect.width / naturalWidth;
    const scaleY = imgRect.height / naturalHeight;

    bubble.style.left = `${block.box.x * scaleX}px`;
    bubble.style.top = `${block.box.y * scaleY}px`;
    bubble.style.width = `${Math.max(46, block.box.width * scaleX)}px`;
    bubble.style.minHeight = `${Math.max(24, block.box.height * scaleY)}px`;

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
