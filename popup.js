import { getConfig, saveConfig } from "./config.js";

const statusNode = document.getElementById("status");
const translatorNode = document.getElementById("translatorProvider");
const ocrNode = document.getElementById("ocrProvider");
const translationModeNode = document.getElementById("translationMode");
const overlayModeNode = document.getElementById("overlayMode");
const aiExpertNode = document.getElementById("aiExpert");

const TRANSLATOR_OPTIONS = [
  ["tencentTransmart", "腾讯翻译君（免费）"],
  ["google", "谷歌翻译（免费）"],
  ["azureTranslator", "微软翻译（免费）"],
  ["deepl", "DeepL"],
  ["deepseek", "DeepSeek-V3.2"],
  ["gemini", "Gemini"],
  ["claude", "Claude"],
  ["azureOpenai", "OpenAI（Azure）"],
  ["openl", "OpenL"],
  ["qwenMt", "Qwen-MT"],
  ["youdao", "有道翻译"],
  ["youdaoLlm", "有道子曰（AI）"],
  ["baiduTranslate", "百度翻译"],
  ["custom", "自定义接口"]
];
const OCR_OPTIONS = [
  ["browser", "浏览器 OCR（免费，Chrome/Edge）"],
  ["ocrspace", "OCR.Space（免费）"],
  ["baiduOcr", "百度 OCR"],
  ["custom", "自定义 OCR"]
];
const TRANSLATION_MODE_OPTIONS = [
  ["standard", "标准翻译"],
  ["aiExpert", "AI 专家翻译"]
];
const OVERLAY_MODE_OPTIONS = [
  ["immersive", "沉浸式嵌入"],
  ["bilingual", "双语对照卡片"],
  ["minimal", "极简高亮"]
];
const AI_EXPERT_OPTIONS = [
  ["general", "通用（默认）"],
  ["manga", "漫画对白强化"],
  ["technical", "技术文档"],
  ["news", "新闻资讯"],
  ["github", "GitHub 代码注释"]
];
const AI_TRANSLATOR_PROVIDERS = new Set([
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
]);

init();

async function init() {
  fillSelect(translatorNode, TRANSLATOR_OPTIONS);
  fillSelect(ocrNode, OCR_OPTIONS);
  fillSelect(translationModeNode, TRANSLATION_MODE_OPTIONS);
  fillSelect(overlayModeNode, OVERLAY_MODE_OPTIONS);
  fillSelect(aiExpertNode, AI_EXPERT_OPTIONS);

  const config = await getConfig();
  bindConfig(config);

  document.getElementById("scanBtn")?.addEventListener("click", onScan);
  document.getElementById("clearBtn")?.addEventListener("click", onClear);
  document.getElementById("settingsBtn")?.addEventListener("click", onSettings);
  document.getElementById("expertsRepoBtn")?.addEventListener("click", onOpenExpertsRepo);
  translatorNode?.addEventListener("change", updateAiExpertAvailability);
  updateAiExpertAvailability();
}

function fillSelect(node, options) {
  node.innerHTML = "";
  for (const [value, label] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    node.appendChild(option);
  }
}

function bindConfig(config) {
  document.getElementById("sourceLang").value = config.sourceLang || "auto";
  document.getElementById("targetLang").value = config.targetLang || "zh-CN";
  translatorNode.value = config.translator.provider || "google";
  ocrNode.value = config.ocr?.provider || "browser";
  translationModeNode.value = config.ui?.translationMode || "standard";
  overlayModeNode.value = config.ui?.overlayMode || "immersive";
  aiExpertNode.value = config.ui?.aiExpert || "general";
}

async function onScan() {
  try {
    const config = await getConfig();
    const chosenMode = translationModeNode.value;
    const chosenProvider = translatorNode.value;
    const useAiExpert = chosenMode === "aiExpert" && AI_TRANSLATOR_PROVIDERS.has(chosenProvider);
    if (chosenMode === "aiExpert" && !useAiExpert) {
      statusNode.textContent = "提示：AI术语库/AI专家不支持谷歌或微软机器翻译，已回退为标准翻译";
    }
    const nextConfig = {
      ...config,
      sourceLang: document.getElementById("sourceLang").value,
      targetLang: document.getElementById("targetLang").value,
      translator: {
        ...config.translator,
        provider: chosenProvider
      },
      ocr: {
        ...config.ocr,
        provider: ocrNode.value
      },
      ui: {
        ...config.ui,
        translationMode: useAiExpert ? "aiExpert" : "standard",
        overlayMode: overlayModeNode.value,
        aiExpert: aiExpertNode.value
      }
    };
    await saveConfig(nextConfig);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const result = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_IMAGES" });
    statusNode.textContent = result?.ok ? `已注入 ${result.count} 个图片翻译按钮` : "扫描失败";
  } catch (error) {
    statusNode.textContent = `翻译失败：${error.message || String(error)}`;
  }
}

async function onClear() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  await chrome.tabs.sendMessage(tab.id, { type: "CLEAR_OVERLAYS" });
  statusNode.textContent = "已清除覆盖层";
}

async function onSettings() {
  await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
}

async function onOpenExpertsRepo() {
  await chrome.tabs.create({
    url: "https://github.com/immersive-translate/prompts"
  });
}

function updateAiExpertAvailability() {
  const isAiProvider = AI_TRANSLATOR_PROVIDERS.has(translatorNode.value);
  if (!isAiProvider && translationModeNode.value === "aiExpert") {
    translationModeNode.value = "standard";
  }
  aiExpertNode.disabled = !isAiProvider;
  if (!isAiProvider) {
    aiExpertNode.title = "当前翻译源为机器翻译（如谷歌/微软），不支持 AI 术语库";
  } else {
    aiExpertNode.title = "";
  }
}
