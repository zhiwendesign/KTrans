import { getSettings, updateSettings } from "../src/storage";
import type { TranslationPortMessage, TranslationPortResponse, TranslationRequest } from "../src/types";
import { translate } from "../src/providers";
import { normalizeError, ProviderError } from "../src/providers/errors";

function post(port: Browser.runtime.Port, message: TranslationPortResponse): void {
  try {
    port.postMessage(message);
  } catch {
    // The page may have closed while a request was finishing.
  }
}

async function runTranslation(
  port: Browser.runtime.Port,
  request: TranslationRequest,
  controller: AbortController
): Promise<void> {
  try {
    const settings = await getSettings();
    const providerId = request.providerId ?? settings.defaultProviderId;
    const provider = settings.providers.find((item) => item.id === providerId);
    if (!provider) throw new ProviderError("NO_PROVIDER", "尚未配置翻译服务。");

    post(port, { type: "start", requestId: request.requestId });
    let result = "";
    const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);
    try {
      for await (const delta of translate(request, provider, controller.signal)) {
        result += delta;
        post(port, { type: "delta", requestId: request.requestId, text: delta });
      }
    } finally {
      clearTimeout(timeout);
    }
    if (!result.trim()) throw new ProviderError("EMPTY", "服务未返回译文。");
    post(port, { type: "done", requestId: request.requestId, text: result });
  } catch (error) {
    const normalized = normalizeError(error);
    post(port, {
      type: "error",
      requestId: request.requestId,
      code: normalized.code,
      message: normalized.code === "CANCELLED" ? "翻译已停止。" : normalized.message
    });
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({
        id: "translate-selection",
        title: "使用 KTrans 翻译",
        contexts: ["selection"]
      });
    });
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== "transpop-translation") return;
    const controllers = new Map<string, AbortController>();

    port.onMessage.addListener((message: TranslationPortMessage) => {
      if (message.type === "cancel") {
        controllers.get(message.requestId)?.abort();
        controllers.delete(message.requestId);
        return;
      }
      const controller = new AbortController();
      controllers.set(message.payload.requestId, controller);
      void runTranslation(port, message.payload, controller).finally(() => {
        controllers.delete(message.payload.requestId);
      });
    });

    port.onDisconnect.addListener(() => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    });
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== "translate-selection") return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await browser.tabs.sendMessage(tab.id, { type: "translate-current-selection" }).catch(() => undefined);
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "translate-selection" || !tab?.id) return;
    await browser.tabs.sendMessage(tab.id, {
      type: "translate-context-selection",
      text: info.selectionText ?? ""
    }).catch(() => undefined);
  });

  browser.runtime.onMessage.addListener((message: { type?: string; host?: string }) => {
    if (message.type === "open-options") return browser.runtime.openOptionsPage();
    if (message.type === "toggle-host" && message.host) {
      return getSettings().then((settings) => {
        const disabled = settings.disabledHosts.includes(message.host!);
        return updateSettings({
          disabledHosts: disabled
            ? settings.disabledHosts.filter((host) => host !== message.host)
            : [...settings.disabledHosts, message.host!]
        });
      });
    }
    return undefined;
  });
});
