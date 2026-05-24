import { useEffect, useRef } from "react";
import "./App.css";
import { ContextMenuProvider } from "./components/ContextMenu";
import { MainWindow } from "./components/MainWindow";
import { NotePad } from "./components/NotePad";
import { ReminderAlarmWindow } from "./components/ReminderAlarmWindow";
import { TileShowcase } from "./components/TileShowcase";
import { applyTabIndentationToTextareaDom } from "./features/notes/indentation";
import { getConfig } from "./features/settings/api";
import { applyTheme, watchSystemTheme } from "./features/settings/theme";
import type { AppConfig, ThemeOption } from "./features/settings/types";
import { getInitialRoute } from "./features/windows/windowRoutes";
import { listen } from "@tauri-apps/api/event";

function App() {
  const route = getInitialRoute();
  const activeView = route.view;
  const tabIndentSizeRef = useRef(2);

  const normalizeTabIndentSize = (value: number | undefined) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 2;
    return Math.max(1, Math.min(8, Math.round(numeric)));
  };

  useEffect(() => {
    let cleanup = () => {};
    getConfig()
      .then((config) => {
        const theme = (config.theme || "system") as ThemeOption;
        applyTheme(theme);
        cleanup = watchSystemTheme(theme);
        tabIndentSizeRef.current = normalizeTabIndentSize(config.tabIndentSize);
      })
      .catch(() => {});
    return () => cleanup();
  }, []);

  useEffect(() => {
    const unlisten = listen<AppConfig>("config-changed", (event) => {
      const theme = (event.payload.theme || "system") as ThemeOption;
      applyTheme(theme);
      watchSystemTheme(theme);
      tabIndentSizeRef.current = normalizeTabIndentSize(event.payload.tabIndentSize);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const preventSystemMenu = (e: KeyboardEvent) => {
      if (e.altKey && e.code === "Space") {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", preventSystemMenu, true);
    return () =>
      document.removeEventListener("keydown", preventSystemMenu, true);
  }, []);

  useEffect(() => {
    const textareaProto = window.HTMLTextAreaElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(textareaProto, "value")?.set;

    const handleTabIndent = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLTextAreaElement)) return;
      if (activeElement.dataset.tabIndent !== "true") return;

      const indent = " ".repeat(normalizeTabIndentSize(tabIndentSizeRef.current));
      const result = applyTabIndentationToTextareaDom(activeElement, event, indent);
      if (!result?.changed) return;

      // 使用原生 setter 绕过 React 的 _valueTracker
      valueSetter?.call(activeElement, result.value);
      // 恢复焦点和选区
      activeElement.focus();
      activeElement.setSelectionRange(result.selectionStart, result.selectionEnd);
      // 派发 input 事件让 onChange 感知到新值
      activeElement.dispatchEvent(new Event("input", { bubbles: true }));
    };

    window.addEventListener("keydown", handleTabIndent, true);
    return () => window.removeEventListener("keydown", handleTabIndent, true);
  }, []);

  return (
    <ContextMenuProvider>
      <div className="h-screen font-body text-ink overflow-hidden">
        {activeView === "main" ? (
          <MainWindow />
        ) : activeView === "notepad" ? (
          <NotePad initialNoteId={route.noteId} />
        ) : activeView === "tile" ? (
          <TileShowcase noteId={route.noteId} />
        ) : (
          <ReminderAlarmWindow reminderId={route.reminderId ?? ""} />
        )}
      </div>
    </ContextMenuProvider>
  );
}

export default App;
