import { getConfig, saveConfig } from "./config.js";

const statusNode = document.getElementById("status");
const translatorNode = document.getElementById("translatorProvider");

const TRANSLATOR_OPTIONS = [
  ["google", "谷歌翻译"],
  ["deepl", "DeepL"],
  ["deepseek", "DeepSeek-V3.2"],
  ["gemini", "Gemini"],
  ["claude", "Claude"],
  ["azureTranslator", "微软翻译"],
  ["youdao", "有道翻译"],
  ["baiduTranslate", "百度翻译"],
  ["custom", "自定义接口"]
];

init();

async function init() {
  fillSelect(translatorNode, TRANSLATOR_OPTIONS);

  const config = await getConfig();
  bindConfig(config);

  document.getElementById("scanBtn")?.addEventListener("click", onScan);
  document.getElementById("clearBtn")?.addEventListener("click", onClear);
  document.getElementById("settingsBtn")?.addEventListener("click", onSettings);
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
}

async function onScan() {
  try {
    const config = await getConfig();
    const nextConfig = {
      ...config,
      sourceLang: document.getElementById("sourceLang").value,
      targetLang: document.getElementById("targetLang").value,
      translator: {
        ...config.translator,
        provider: translatorNode.value
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
