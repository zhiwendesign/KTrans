import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, Copy, Languages, LoaderCircle, RotateCcw, Settings, Square, X } from "lucide-react";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { MAX_SELECTION_LENGTH } from "../../src/constants";
import { t } from "../../src/i18n";
import { getSettings } from "../../src/storage";
import type { SelectionPayload, Settings as AppSettings, TranslationPortResponse } from "../../src/types";
import "./style.css";

type PanelState = "idle" | "loading" | "done" | "error" | "cancelled";

function inputSelection(): SelectionPayload | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return null;
  const start = active.selectionStart ?? 0;
  const end = active.selectionEnd ?? 0;
  if (start === end) return null;
  const text = active.value.slice(start, end).trim();
  if (!text) return null;
  const rect = active.getBoundingClientRect();
  return { text, rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } };
}

function currentSelection(fallbackText = ""): SelectionPayload | null {
  const input = inputSelection();
  if (input) return input;
  const selection = window.getSelection();
  const text = (selection?.toString() || fallbackText).trim();
  if (!text) return null;
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const rawRect = range?.getBoundingClientRect();
  const rect = rawRect && (rawRect.width || rawRect.height)
    ? rawRect
    : new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
  return { text, rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } };
}

function getPosition(rect: SelectionPayload["rect"], panel: boolean): React.CSSProperties {
  const width = panel ? Math.min(380, window.innerWidth - 24) : 30;
  const estimatedHeight = panel ? 360 : 30;
  const left = Math.max(12, Math.min(rect.right + 8, window.innerWidth - width - 12));
  const below = rect.bottom + 8;
  const top = below + estimatedHeight <= window.innerHeight
    ? below
    : Math.max(12, rect.top - estimatedHeight - 8);
  return { left, top, width };
}

function IconButton({ title, onClick, disabled, children }: React.PropsWithChildren<{
  title: string;
  onClick: () => void;
  disabled?: boolean;
}>) {
  return <button className="tp-icon-button" type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}>{children}</button>;
}

function Translator() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [state, setState] = useState<PanelState>("idle");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const portRef = useRef<Browser.runtime.Port | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const selectionRef = useRef<SelectionPayload | null>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
    const listener = (changes: Record<string, Browser.storage.StorageChange>, area: string) => {
      if (area === "local" && Object.keys(changes).some((key) => key.includes("transpop"))) {
        void getSettings().then(setSettings);
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const stop = useCallback(() => {
    if (requestIdRef.current && portRef.current) {
      portRef.current.postMessage({ type: "cancel", requestId: requestIdRef.current });
    }
    requestIdRef.current = null;
    setState((value) => value === "loading" ? "cancelled" : value);
  }, []);

  const close = useCallback(() => {
    stop();
    setPanelOpen(false);
    setResult("");
    setError("");
  }, [stop]);

  const startTranslation = useCallback((payload?: SelectionPayload) => {
    const selected = payload ?? selectionRef.current;
    if (!selected) return;
    selectionRef.current = selected;
    setSelection(selected);
    setPanelOpen(true);
    setResult("");
    setError("");
    setCopied(false);

    if (selected.text.length > MAX_SELECTION_LENGTH) {
      setState("error");
      setError(t(settings?.locale ?? "zh-CN", "tooLong"));
      return;
    }
    if (!settings?.defaultProviderId || !settings.providers.some((item) => item.id === settings.defaultProviderId)) {
      setState("error");
      setError(t(settings?.locale ?? "zh-CN", "noProviderDetail"));
      return;
    }

    stop();
    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    setState("loading");
    const port = browser.runtime.connect({ name: "transpop-translation" });
    portRef.current?.disconnect();
    portRef.current = port;
    let complete = "";

    port.onMessage.addListener((message: TranslationPortResponse) => {
      if (message.requestId !== requestId) return;
      if (message.type === "delta") {
        complete += message.text;
        setResult(complete);
      } else if (message.type === "done") {
        requestIdRef.current = null;
        setResult(message.text);
        setState("done");
        port.disconnect();
      } else if (message.type === "error") {
        requestIdRef.current = null;
        if (message.code === "CANCELLED") setState("cancelled");
        else {
          setState("error");
          setError(message.message);
        }
        port.disconnect();
      }
    });
    port.postMessage({
      type: "translate",
      payload: {
        requestId,
        text: selected.text,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        providerId: settings.defaultProviderId
      }
    });
  }, [settings, stop]);

  useEffect(() => {
    const refreshSelection = () => {
      if (panelOpen) return;
      const selected = currentSelection();
      selectionRef.current = selected;
      setSelection(selected);
      if (selected && settings?.triggerMode === "instant") startTranslation(selected);
    };
    const pointerUp = (event: PointerEvent) => {
      const path = event.composedPath();
      if (path.some((node) => node instanceof HTMLElement && node.dataset?.transpopRoot === "true")) return;
      window.setTimeout(refreshSelection, 20);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "Shift" || event.key.startsWith("Arrow")) window.setTimeout(refreshSelection, 20);
    };
    const outside = (event: PointerEvent) => {
      if (!panelOpen) return;
      const path = event.composedPath();
      if (!path.some((node) => node instanceof HTMLElement && node.dataset?.transpopRoot === "true")) close();
    };
    document.addEventListener("pointerup", pointerUp, true);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keyup", keyUp, true);
    const message = (payload: { type?: string; text?: string }) => {
      if (payload.type === "translate-current-selection" || payload.type === "translate-context-selection") {
        const selected = currentSelection(payload.text);
        if (selected) startTranslation(selected);
      }
    };
    browser.runtime.onMessage.addListener(message);
    return () => {
      document.removeEventListener("pointerup", pointerUp, true);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keyup", keyUp, true);
      browser.runtime.onMessage.removeListener(message);
    };
  }, [close, panelOpen, settings?.triggerMode, startTranslation]);

  useEffect(() => () => portRef.current?.disconnect(), []);

  if (!settings || settings.disabledHosts.includes(location.hostname) || !selection) return null;
  const locale = settings.locale;
  const theme = settings.theme === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : settings.theme;

  if (!panelOpen) {
    if (settings.triggerMode !== "button") return null;
    return (
      <div data-transpop-root="true" className={`tp-root tp-${theme}`} style={getPosition(selection.rect, false)}>
        <button className="tp-trigger" type="button" title={t(locale, "translate")} aria-label={t(locale, "translate")} onClick={() => startTranslation(selection)}>
          <Languages size={17} />
        </button>
      </div>
    );
  }

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(locale === "zh-CN" ? "复制失败，请重试。" : "Copy failed. Please try again.");
    }
  };

  return (
    <section
      data-transpop-root="true"
      className={`tp-root tp-panel tp-${theme} tp-font-${settings.fontSize}`}
      style={getPosition(selection.rect, true)}
      role="dialog"
      aria-label={t(locale, "translate")}
    >
      <header className="tp-header">
        <div className="tp-brand"><Languages size={17} /><strong>KTrans</strong></div>
        <div className="tp-header-actions">
          <IconButton title={t(locale, "settings")} onClick={() => void browser.runtime.sendMessage({ type: "open-options" })}><Settings size={16} /></IconButton>
          <IconButton title={t(locale, "close")} onClick={close}><X size={17} /></IconButton>
        </div>
      </header>

      <div className="tp-language-row">
        <span>{settings.sourceLanguage === "auto" ? (locale === "zh-CN" ? "自动检测" : "Auto") : settings.sourceLanguage}</span>
        <span aria-hidden="true">→</span>
        <span>{settings.targetLanguage}</span>
      </div>

      <div className="tp-body">
        {settings.showSource && <div className="tp-source">{selection.text}</div>}
        <div className={`tp-result ${state === "error" ? "tp-error" : ""}`} aria-live="polite">
          {state === "loading" && !result && <span className="tp-loading"><LoaderCircle className="tp-spin" size={17} />{t(locale, "translating")}</span>}
          {result || error || (state === "cancelled" ? (locale === "zh-CN" ? "翻译已停止。" : "Translation stopped.") : "")}
        </div>
      </div>

      <footer className="tp-footer">
        <div>
          {state === "loading" ? (
            <IconButton title={t(locale, "cancel")} onClick={stop}><Square size={15} /></IconButton>
          ) : (
            <IconButton title={t(locale, "retry")} onClick={() => startTranslation(selection)}><RotateCcw size={16} /></IconButton>
          )}
        </div>
        <button className="tp-copy" type="button" disabled={!result} onClick={() => void copy()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? t(locale, "copied") : t(locale, "copy")}</span>
        </button>
      </footer>
    </section>
  );
}

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "transpop-selection",
      position: "inline",
      anchor: "body",
      onMount(container) {
        const root = createRoot(container);
        root.render(<Translator />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      }
    });
    ui.mount();
  }
});
