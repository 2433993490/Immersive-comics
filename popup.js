const statusNode = document.getElementById("status");

document.getElementById("scanBtn")?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const result = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_IMAGES" });
  statusNode.textContent = result?.ok ? `已注入 ${result.count} 个图片翻译按钮` : "扫描失败";
});

document.getElementById("clearBtn")?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  await chrome.tabs.sendMessage(tab.id, { type: "CLEAR_OVERLAYS" });
  statusNode.textContent = "已清除覆盖层";
});

document.getElementById("settingsBtn")?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
});
