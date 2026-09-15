import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, ChevronRight, Eye, EyeOff, Languages, Plus, Save, Server, Shield, Trash2, X } from "lucide-react";
import { LANGUAGES } from "../../src/constants";
import { getSettings, saveSettings } from "../../src/storage";
import type { ProviderConfig, Settings } from "../../src/types";
import "./style.css";

function blankProvider(): ProviderConfig {
  return {
    id: crypto.randomUUID(),
    name: "OpenAI Compatible",
    protocol: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    customHeaders: {},
    temperature: 0.2,
    stream: true,
    timeoutMs: 60_000
  };
}

function originPattern(value: string): string {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new Error("API 地址必须使用 HTTP 或 HTTPS。");
  return `${url.origin}/*`;
}

function Section({ title, description, children }: React.PropsWithChildren<{ title: string; description: string }>) {
  return <section className="section"><div className="section-heading"><h2>{title}</h2><p>{description}</p></div><div className="section-content">{children}</div></section>;
}

function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProviderConfig | null>(null);
  const [headersText, setHeadersText] = useState("{}");
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void getSettings().then((value) => {
      setSettings(value);
      const first = value.providers.find((item) => item.id === value.defaultProviderId) ?? value.providers[0];
      if (first) selectProvider(first);
      else newProvider();
    });
  }, []);

  const selectProvider = (provider: ProviderConfig) => {
    setSelectedId(provider.id);
    setDraft(structuredClone(provider));
    setHeadersText(JSON.stringify(provider.customHeaders, null, 2));
    setNotice(null);
  };

  const newProvider = () => {
    const provider = blankProvider();
    setSelectedId(null);
    setDraft(provider);
    setHeadersText("{}");
    setNotice(null);
  };

  const validatedDraft = (): ProviderConfig => {
    if (!draft) throw new Error("Provider 不存在。");
    if (!draft.name.trim()) throw new Error("请填写服务名称。");
    originPattern(draft.baseUrl);
    if (!draft.model.trim()) throw new Error("请填写模型名称。");
    let headers: unknown;
    try { headers = JSON.parse(headersText || "{}"); } catch { throw new Error("自定义 Headers 必须是有效 JSON。"); }
    if (!headers || Array.isArray(headers) || typeof headers !== "object") throw new Error("自定义 Headers 必须是 JSON 对象。");
    if (!Object.values(headers).every((value) => typeof value === "string")) throw new Error("Header 的值必须是字符串。");
    return {
      ...draft,
      name: draft.name.trim(),
      baseUrl: draft.baseUrl.trim().replace(/\/+$/, ""),
      model: draft.model.trim(),
      customHeaders: headers as Record<string, string>,
      timeoutMs: Math.max(10_000, Math.min(180_000, draft.timeoutMs))
    };
  };

  const persist = async (providerOverride?: ProviderConfig) => {
    if (!settings) return;
    const provider = providerOverride ?? validatedDraft();
    const exists = settings.providers.some((item) => item.id === provider.id);
    const providers = exists
      ? settings.providers.map((item) => item.id === provider.id ? provider : item)
      : [...settings.providers, provider];
    const next = { ...settings, providers, defaultProviderId: settings.defaultProviderId ?? provider.id };
    await saveSettings(next);
    setSettings(next);
    setSelectedId(provider.id);
    setDraft(provider);
    setNotice({ kind: "ok", text: "设置已保存。" });
    return next;
  };

  const requestPermission = async (provider: ProviderConfig) => {
    const pattern = originPattern(provider.baseUrl);
    const granted = await browser.permissions.request({ origins: [pattern] });
    if (!granted) throw new Error("未获得访问该 API 地址的权限。");
  };

  const testConnection = async () => {
    if (!settings) return;
    setTesting(true);
    setNotice(null);
    try {
      const provider = validatedDraft();
      await requestPermission(provider);
      await persist(provider);
      const port = browser.runtime.connect({ name: "transpop-translation" });
      const requestId = crypto.randomUUID();
      const message = await new Promise<{ ok: boolean; text: string }>((resolve) => {
        const timer = window.setTimeout(() => {
          port.disconnect();
          resolve({ ok: false, text: "连接测试超时。" });
        }, Math.min(provider.timeoutMs + 1000, 30_000));
        port.onMessage.addListener((response) => {
          if (response.requestId !== requestId) return;
          if (response.type === "done" || response.type === "error") {
            window.clearTimeout(timer);
            resolve({ ok: response.type === "done", text: response.type === "done" ? "连接成功，服务已返回译文。" : response.message });
            port.disconnect();
          }
        });
        port.postMessage({
          type: "translate",
          payload: { requestId, text: "Hello", sourceLanguage: "en", targetLanguage: "zh-CN", providerId: provider.id }
        });
      });
      const tested = { ...provider, lastTest: { ok: message.ok, message: message.text, at: Date.now() } };
      await persist(tested);
      setNotice({ kind: message.ok ? "ok" : "error", text: message.text });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "连接测试失败。" });
    } finally {
      setTesting(false);
    }
  };

  const removeProvider = async () => {
    if (!settings || !draft) return;
    const providers = settings.providers.filter((item) => item.id !== draft.id);
    const next = {
      ...settings,
      providers,
      defaultProviderId: settings.defaultProviderId === draft.id ? providers[0]?.id : settings.defaultProviderId
    };
    await saveSettings(next);
    setSettings(next);
    if (providers[0]) selectProvider(providers[0]);
    else newProvider();
  };

  const updatePreference = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    await saveSettings(next);
  };

  const isSaved = useMemo(() => settings?.providers.some((item) => item.id === draft?.id) ?? false, [draft?.id, settings?.providers]);
  if (!settings || !draft) return <div className="loading">正在加载设置…</div>;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Languages size={20} /></div><div><strong>KTrans</strong><span>划词翻译</span></div></div>
        <nav>
          <a className="active" href="#providers"><Server size={17} />翻译服务</a>
          <a href="#preferences"><Languages size={17} />翻译设置</a>
          <a href="#privacy"><Shield size={17} />隐私与安全</a>
        </nav>
        <div className="version">Version 0.1.0</div>
      </aside>

      <main>
        <header className="page-header"><div><h1>设置</h1><p>配置翻译服务和网页划词行为。</p></div></header>

        <Section title="翻译服务" description="API Key 仅保存在本机，并只由扩展后台用于请求。">
          <div id="providers" className="provider-layout">
            <div className="provider-list">
              {settings.providers.map((provider) => (
                <button key={provider.id} type="button" className={`provider-item ${draft.id === provider.id ? "selected" : ""}`} onClick={() => selectProvider(provider)}>
                  <span className="provider-status"><Server size={16} /></span>
                  <span><strong>{provider.name}</strong><small>{provider.model}</small></span>
                  {settings.defaultProviderId === provider.id && <em>默认</em>}
                  <ChevronRight size={15} />
                </button>
              ))}
              <button className="add-provider" type="button" onClick={newProvider}><Plus size={16} />添加服务</button>
            </div>

            <div className="provider-form">
              <div className="form-title"><div><h3>{isSaved ? "编辑服务" : "添加翻译服务"}</h3><p>支持 OpenAI 和 Anthropic 兼容接口。</p></div>{isSaved && <button className="icon danger" type="button" title="删除服务" onClick={() => void removeProvider()}><Trash2 size={17} /></button>}</div>
              <div className="grid two">
                <label><span>服务名称</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
                <label><span>接口协议</span><select value={draft.protocol} onChange={(e) => setDraft({ ...draft, protocol: e.target.value as ProviderConfig["protocol"] })}><option value="openai">OpenAI-compatible</option><option value="anthropic">Anthropic-compatible</option></select></label>
              </div>
              <label><span>Base URL</span><input type="url" placeholder="https://api.openai.com/v1" value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} /><small>保存或测试时会请求访问该域名的权限。</small></label>
              <label><span>API Key</span><div className="input-action"><input type={showKey ? "text" : "password"} value={draft.apiKey} placeholder="本地免鉴权服务可留空" onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} /><button type="button" title={showKey ? "隐藏密钥" : "显示密钥"} onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
              <label><span>模型名称</span><input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></label>
              <div className="grid three">
                <label><span>Temperature</span><input type="number" min="0" max="2" step="0.1" value={draft.temperature} onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })} /></label>
                <label><span>最大 Tokens</span><input type="number" min="1" placeholder="服务默认" value={draft.maxTokens ?? ""} onChange={(e) => setDraft({ ...draft, maxTokens: e.target.value ? Number(e.target.value) : undefined })} /></label>
                <label><span>超时（秒）</span><input type="number" min="10" max="180" value={draft.timeoutMs / 1000} onChange={(e) => setDraft({ ...draft, timeoutMs: Number(e.target.value) * 1000 })} /></label>
              </div>
              <label><span>自定义 Headers</span><textarea rows={4} spellCheck={false} value={headersText} onChange={(e) => setHeadersText(e.target.value)} /></label>
              <label className="switch-row"><span><strong>流式输出</strong><small>逐步显示翻译结果。</small></span><input type="checkbox" checked={draft.stream} onChange={(e) => setDraft({ ...draft, stream: e.target.checked })} /></label>
              {notice && <div className={`notice ${notice.kind}`}>{notice.kind === "ok" ? <Check size={16} /> : <X size={16} />}{notice.text}</div>}
              <div className="form-actions">
                <button className="secondary" type="button" disabled={testing} onClick={() => void testConnection()}>{testing ? "正在测试…" : "测试连接"}</button>
                <button className="primary" type="button" onClick={() => void persist().catch((error) => setNotice({ kind: "error", text: error.message }))}><Save size={16} />保存服务</button>
              </div>
            </div>
          </div>
        </Section>

        <Section title="翻译设置" description="设置默认语言以及划词后的触发方式。">
          <div id="preferences" className="preferences">
            <div className="grid two">
              <label><span>源语言</span><select value={settings.sourceLanguage} onChange={(e) => void updatePreference("sourceLanguage", e.target.value)}>{LANGUAGES.map(([code, zh]) => <option key={code} value={code}>{zh}</option>)}</select></label>
              <label><span>目标语言</span><select value={settings.targetLanguage} onChange={(e) => void updatePreference("targetLanguage", e.target.value)}>{LANGUAGES.filter(([code]) => code !== "auto").map(([code, zh]) => <option key={code} value={code}>{zh}</option>)}</select></label>
            </div>
            <div className="grid two">
              <label><span>触发方式</span><select value={settings.triggerMode} onChange={(e) => void updatePreference("triggerMode", e.target.value as Settings["triggerMode"])}><option value="button">显示翻译图标</option><option value="instant">选择后立即翻译</option><option value="shortcut">仅快捷键</option></select></label>
              <label><span>浮窗字号</span><select value={settings.fontSize} onChange={(e) => void updatePreference("fontSize", e.target.value as Settings["fontSize"])}><option value="small">小</option><option value="medium">标准</option><option value="large">大</option></select></label>
            </div>
            <div className="grid two">
              <label><span>主题</span><select value={settings.theme} onChange={(e) => void updatePreference("theme", e.target.value as Settings["theme"])}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
              <label><span>界面语言</span><select value={settings.locale} onChange={(e) => void updatePreference("locale", e.target.value as Settings["locale"])}><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>
            </div>
            <label className="switch-row"><span><strong>在浮窗中显示原文</strong><small>关闭后只展示翻译结果。</small></span><input type="checkbox" checked={settings.showSource} onChange={(e) => void updatePreference("showSource", e.target.checked)} /></label>
          </div>
        </Section>

        <Section title="隐私与安全" description="KTrans 不建设中转服务器，也不收集翻译内容。">
          <div id="privacy" className="privacy"><Shield size={20} /><div><strong>你的密钥和配置保存在浏览器本地</strong><p>选中文字只会发送给你配置的 API 服务。请避免翻译密码、身份信息或其他敏感内容。</p></div></div>
          {settings.disabledHosts.length > 0 && <div className="disabled-list"><h3>已禁用的网站</h3>{settings.disabledHosts.map((host) => <div key={host}><span>{host}</span><button type="button" onClick={() => void updatePreference("disabledHosts", settings.disabledHosts.filter((item) => item !== host))}><X size={15} />移除</button></div>)}</div>}
        </Section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
