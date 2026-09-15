import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "KTrans - 划词翻译",
    description: "使用你自己的 API，在网页中划词翻译并复制译文。",
    permissions: ["storage", "activeTab", "contextMenus"],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    commands: {
      "translate-selection": {
        suggested_key: {
          default: "Ctrl+Shift+S",
          mac: "Command+Shift+S"
        },
        description: "翻译当前选区"
      }
    }
  }
});
