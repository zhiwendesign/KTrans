import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Languages, Settings as SettingsIcon } from "lucide-react";
import { LANGUAGES } from "../../src/constants";
import { getSettings, saveSettings } from "../../src/storage";
import type { Settings } from "../../src/types";
import "./style.css";

function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [host, setHost] = useState("");
  useEffect(() => {
    void Promise.all([getSettings(), browser.tabs.query({ active: true, currentWindow: true })]).then(([value, tabs]) => {
      setSettings(value);
      try { setHost(new URL(tabs[0]?.url ?? "").hostname); } catch { setHost(""); }
    });
  }, []);
  if (!settings) return <div className="popup loading">加载中…</div>;
  const provider = settings.providers.find((item) => item.id === settings.defaultProviderId);
  const disabled = !!host && settings.disabledHosts.includes(host);
  const update = async (next: Settings) => { setSettings(next); await saveSettings(next); };
  const toggleHost = () => {
    if (!host) return;
    void update({ ...settings, disabledHosts: disabled ? settings.disabledHosts.filter((item) => item !== host) : [...settings.disabledHosts, host] });
  };
  const translateCurrent = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await browser.tabs.sendMessage(tab.id, { type: "translate-current-selection" }).catch(() => undefined);
    window.close();
  };
  return <div className="popup">
    <header><div className="mark"><Languages size={18} /></div><div><strong>KTrans</strong><span>划词翻译</span></div><button title="打开设置" onClick={() => void browser.runtime.openOptionsPage()}><SettingsIcon size={17} /></button></header>
    <div className={`provider ${provider ? "ready" : "missing"}`}><span>{provider ? "当前服务" : "尚未配置服务"}</span><strong>{provider ? provider.name : "请前往设置添加 API"}</strong>{provider && <small>{provider.model}</small>}</div>
    <label><span>目标语言</span><select value={settings.targetLanguage} onChange={(e) => void update({ ...settings, targetLanguage: e.target.value })}>{LANGUAGES.filter(([code]) => code !== "auto").map(([code, zh]) => <option key={code} value={code}>{zh}</option>)}</select></label>
    <label className="toggle"><span><strong>在此网站启用</strong><small>{host || "当前页面不支持"}</small></span><input type="checkbox" disabled={!host} checked={!disabled} onChange={toggleHost} /></label>
    <button className="translate" disabled={!provider || disabled} onClick={() => void translateCurrent()}><Languages size={16} />翻译当前选区</button>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
