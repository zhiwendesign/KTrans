import { DEFAULT_SETTINGS, SETTINGS_KEY } from "./constants";
import type { Settings } from "./types";

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  const saved = result[SETTINGS_KEY] as Partial<Settings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    providers: saved?.providers ?? [],
    disabledHosts: saved?.disabledHosts ?? []
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await saveSettings(next);
  return next;
}
