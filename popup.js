import { getConfig, saveConfig } from "./config.js";

const statusNode = document.getElementById("status");
const translatorNode = document.getElementById("translatorProvider");
const aiExpertNode = document.getElementById("aiExpert");

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

const AI_EXPERT_PRESETS = {
  general:
    "你是通用翻译专家，请将以下文本准确翻译成{{targetLang}}，保留语气和风格，不要添加解释：\n{{text}}",
  github:
    "你是 GitHub 内容翻译专家。请把以下内容翻译成{{targetLang}}，保留代码块、术语、Markdown 结构和链接：\n{{text}}",
  finance:
    "你是金融翻译专家。请将以下金融文本翻译成{{targetLang}}，确保专业术语准确、表达自然：\n{{text}}",
  paraphrase:
    "你是意译专家。先忠实理解原文，再用更自然的{{targetLang}}表达，保留原意，不要解释：\n{{text}}"
};

const AI_EXPERT_OPTIONS = [
  ["general", "通用"],
  ["github", "GitHub 翻译增强器"],
  ["finance", "金融专家"],
  ["paraphrase", "意译大师"]
];

init();

async function init() {
  fillSelect(translatorNode, TRANSLATOR_OPTIONS);
  fillSelect(aiExpertNode, AI_EXPERT_OPTIONS);

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
  document.getElementById("aiEnabled").checked = Boolean(config.ai.enabled);
  aiExpertNode.value = config.ai.expert || "general";
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
      },
      ai: {
        ...config.ai,
        enabled: document.getElementById("aiEnabled").checked,
        expert: aiExpertNode.value,
        promptTemplate: AI_EXPERT_PRESETS[aiExpertNode.value] || config.ai.promptTemplate
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
