import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeftRight, Check, ChevronDown, Copy, Languages, LoaderCircle, Pin, RotateCcw, Settings, Square, Volume2, X } from "lucide-react";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { LANGUAGES, MAX_SELECTION_LENGTH } from "../../src/constants";
import { t } from "../../src/i18n";
import { matchesShortcut } from "../../src/shortcut";
import { getSettings, saveSettings } from "../../src/storage";
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
  const estimatedHeight = panel ? 500 : 30;
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
  const [pinned, setPinned] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("zh-CN");
  const [providerId, setProviderId] = useState("");
  const portRef = useRef<Browser.runtime.Port | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const selectionRef = useRef<SelectionPayload | null>(null);

  useEffect(() => {
    void getSettings().then((value) => {
      setSettings(value);
      setSourceLanguage(value.sourceLanguage);
      setTargetLanguage(value.targetLanguage);
      setProviderId(value.defaultProviderId ?? "");
    });
    const listener = (changes: Record<string, Browser.storage.StorageChange>, area: string) => {
      if (area === "local" && Object.keys(changes).some((key) => key.includes("transpop"))) {
        void getSettings().then((value) => {
          setSettings(value);
          setSourceLanguage(value.sourceLanguage);
          setTargetLanguage(value.targetLanguage);
          setProviderId(value.defaultProviderId ?? "");
        });
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
    if (!providerId || !settings?.providers.some((item) => item.id === providerId)) {
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
        sourceLanguage,
        targetLanguage,
        providerId
      }
    });
  }, [providerId, settings, sourceLanguage, stop, targetLanguage]);

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
    const keyDown = (event: KeyboardEvent) => {
      if (!settings?.selectionShortcut || !matchesShortcut(event, settings.selectionShortcut)) return;
      const selected = currentSelection();
      if (!selected) return;
      event.preventDefault();
      event.stopPropagation();
      startTranslation(selected);
    };
    const outside = (event: PointerEvent) => {
      if (!panelOpen || pinned) return;
      const path = event.composedPath();
      if (!path.some((node) => node instanceof HTMLElement && node.dataset?.transpopRoot === "true")) close();
    };
    document.addEventListener("pointerup", pointerUp, true);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keyup", keyUp, true);
    document.addEventListener("keydown", keyDown, true);
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
      document.removeEventListener("keydown", keyDown, true);
      browser.runtime.onMessage.removeListener(message);
    };
  }, [close, panelOpen, pinned, settings?.selectionShortcut, settings?.triggerMode, startTranslation]);

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

  const copySource = async () => {
    await navigator.clipboard.writeText(selection.text).catch(() => undefined);
  };

  const speakSource = () => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selection.text);
    if (sourceLanguage !== "auto") utterance.lang = sourceLanguage;
    speechSynthesis.speak(utterance);
  };

  const updateLanguage = async (key: "sourceLanguage" | "targetLanguage", value: string) => {
    if (key === "sourceLanguage") setSourceLanguage(value);
    else setTargetLanguage(value);
    const next = { ...settings, [key]: value };
    setSettings(next);
    await saveSettings(next);
  };

  const swapLanguages = async () => {
    const nextSource = targetLanguage;
    const nextTarget = sourceLanguage === "auto" ? "en" : sourceLanguage;
    setSourceLanguage(nextSource);
    setTargetLanguage(nextTarget);
    const next = { ...settings, sourceLanguage: nextSource, targetLanguage: nextTarget };
    setSettings(next);
    await saveSettings(next);
  };

  const changeProvider = async (value: string) => {
    setProviderId(value);
    const next = { ...settings, defaultProviderId: value };
    setSettings(next);
    await saveSettings(next);
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
          <IconButton title={pinned ? (locale === "zh-CN" ? "取消固定" : "Unpin") : (locale === "zh-CN" ? "固定弹窗" : "Pin")} onClick={() => setPinned(!pinned)}><Pin className={pinned ? "tp-pin-active" : ""} size={16} /></IconButton>
          <IconButton title={t(locale, "settings")} onClick={() => void browser.runtime.sendMessage({ type: "open-options" })}><Settings size={16} /></IconButton>
          <IconButton title={t(locale, "close")} onClick={close}><X size={17} /></IconButton>
        </div>
      </header>

      {settings.showSource && <div className="tp-source-card">
        <div className="tp-source-text">{selection.text}</div>
        <div className="tp-source-actions">
          <IconButton title={locale === "zh-CN" ? "朗读原文" : "Read source"} onClick={speakSource}><Volume2 size={17} /></IconButton>
          <IconButton title={locale === "zh-CN" ? "复制原文" : "Copy source"} onClick={() => void copySource()}><Copy size={16} /></IconButton>
        </div>
      </div>}

      <div className="tp-language-row">
        <label>
          <select aria-label={locale === "zh-CN" ? "源语言" : "Source language"} value={sourceLanguage} onChange={(event) => void updateLanguage("sourceLanguage", event.target.value)}>
            {LANGUAGES.map(([code, zh, en]) => <option key={code} value={code}>{locale === "zh-CN" ? zh : en}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <IconButton title={locale === "zh-CN" ? "交换语言" : "Swap languages"} onClick={() => void swapLanguages()}><ArrowLeftRight size={17} /></IconButton>
        <label>
          <select aria-label={locale === "zh-CN" ? "目标语言" : "Target language"} value={targetLanguage} onChange={(event) => void updateLanguage("targetLanguage", event.target.value)}>
            {LANGUAGES.filter(([code]) => code !== "auto").map(([code, zh, en]) => <option key={code} value={code}>{locale === "zh-CN" ? zh : en}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
      </div>

      <div className="tp-body">
        <div className="tp-provider-card">
          <div className="tp-provider-heading">
            <div className="tp-provider-name"><span className="tp-provider-logo"><Languages size={15} /></span>
              {settings.providers.length > 1 ? (
                <select aria-label={locale === "zh-CN" ? "翻译服务" : "Provider"} value={providerId} onChange={(event) => void changeProvider(event.target.value)}>
                  {settings.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                </select>
              ) : <strong>{settings.providers.find((provider) => provider.id === providerId)?.name ?? "KTrans"}</strong>}
            </div>
            {state === "loading" ? <IconButton title={t(locale, "cancel")} onClick={stop}><Square size={14} /></IconButton> : <IconButton title={t(locale, "retry")} onClick={() => startTranslation(selection)}><RotateCcw size={16} /></IconButton>}
          </div>
          <div className={`tp-result ${state === "error" ? "tp-error" : ""}`} aria-live="polite">
            {state === "loading" && !result && <span className="tp-loading"><LoaderCircle className="tp-spin" size={17} />{t(locale, "translating")}</span>}
            {result || error || (state === "cancelled" ? (locale === "zh-CN" ? "翻译已停止。" : "Translation stopped.") : "")}
          </div>
        </div>
      </div>

      <footer className="tp-footer">
        <span className="tp-shortcut-hint">{settings.selectionShortcut}</span>
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
