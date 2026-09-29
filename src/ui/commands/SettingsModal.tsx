import type { JSX } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Notice } from "obsidian";
import { t, tf, type Locale } from "../../services/i18n";
import { installDialogFocus } from "../components/dialog-focus";
import { CloseIcon, SettingsIcon, TempoLogoIcon } from "../icons/Icons";

export interface SettingsModalProps {
  isOpen: boolean;
  locale: Locale;
  version: string;
  defaultDest: "inbox" | "today";
  taskCount: number;
  projectCount: number;
  cycleCount: number;
  exportFolder?: string;
  onClose: () => void;
  onChangeLocale: (locale: Locale) => void;
  onChangeDefaultDest: (dest: "inbox" | "today") => void;
  onChangeExportFolder?: (folder: string) => void;
  onResetData: () => Promise<boolean>;
  onExportData: (customFolder?: string) => Promise<string>;
}

export function SettingsModal({
  isOpen,
  locale,
  version,
  defaultDest,
  taskCount,
  projectCount,
  cycleCount,
  exportFolder,
  onClose,
  onChangeLocale,
  onChangeDefaultDest,
  onChangeExportFolder,
  onResetData,
  onExportData,
}: SettingsModalProps): JSX.Element | null {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetFailed, setResetFailed] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFolderDraft, setExportFolderDraft] = useState(exportFolder || "");
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const removeKeyboard = installDialogFocus(card, onClose);
    card.querySelector<HTMLButtonElement>(".tempo-window-close-btn")?.focus();
    return removeKeyboard;
  }, []);

  const handleExecuteReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    const saved = await onResetData();
    setIsResetting(false);
    setConfirmReset(false);
    setResetFailed(!saved);
    setResetMessage(saved ? t("resetSuccess", locale) : t("resetNotSaved", locale));
    if (saved) setTimeout(() => setResetMessage(null), 3000);
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const path = await onExportData(exportFolderDraft.trim() || undefined);
      new Notice(tf("exportDone", locale, { path }));
    } catch (err) {
      new Notice(tf("exportFailed", locale, { detail: String(err) }));
    } finally {
      setIsExporting(false);
    }
  };

  // The guard sits after every hook so the hook order cannot change between renders.
  if (!isOpen) return null;

  return (
    <div
      className="tempo-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("settings", locale)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tempo-window-card" ref={cardRef} style={{ maxWidth: 500 }}>
        {/* Titlebar */}
        <div className="tempo-window-header">
          <div className="tempo-window-title-left">
            <SettingsIcon size={16} />
            <span className="tempo-window-title">{t("settings", locale)}</span>
          </div>
          <button
            type="button"
            className="tempo-window-close-btn"
            onClick={onClose}
            title={`${t("closeBtn", locale)} (Esc)`}
          >
            <CloseIcon size={13} />
          </button>
        </div>

        {/* Settings Body */}
        <div className="tempo-window-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {/* Section 1: General Preferences */}
          <div className="tempo-settings-section">
            <div className="tempo-settings-section-title">{t("generalSettings", locale)}</div>

            {/* Language Setting */}
            <div className="tempo-settings-item">
              <div className="tempo-settings-label-group">
                <span className="tempo-settings-item-title">{t("language", locale)}</span>
                <span className="tempo-settings-item-desc">{t("languageDesc", locale)}</span>
              </div>
              <div className="tempo-segmented-control">
                <button
                  type="button"
                  className={`tempo-segmented-btn ${locale === "zh" ? "is-active" : ""}`}
                  onClick={() => onChangeLocale("zh")}
                >
                  {t("languageZh", locale)}
                </button>
                <button
                  type="button"
                  className={`tempo-segmented-btn ${locale === "en" ? "is-active" : ""}`}
                  onClick={() => onChangeLocale("en")}
                >
                  {t("languageEn", locale)}
                </button>
              </div>
            </div>

            {/* Default Destination Setting */}
            <div className="tempo-settings-item" style={{ marginTop: 12 }}>
              <div className="tempo-settings-label-group">
                <span className="tempo-settings-item-title">{t("defaultDestination", locale)}</span>
                <span className="tempo-settings-item-desc">{t("defaultDestDesc", locale)}</span>
              </div>
              <div className="tempo-segmented-control">
                <button
                  type="button"
                  className={`tempo-segmented-btn ${defaultDest === "inbox" ? "is-active" : ""}`}
                  onClick={() => onChangeDefaultDest("inbox")}
                >
                  {t("inbox", locale)}
                </button>
                <button
                  type="button"
                  className={`tempo-segmented-btn ${defaultDest === "today" ? "is-active" : ""}`}
                  onClick={() => onChangeDefaultDest("today")}
                >
                  {t("today", locale)}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Data & Storage */}
          <div className="tempo-settings-section" style={{ marginTop: 20 }}>
            <div className="tempo-settings-section-title">{t("dataSettings", locale)}</div>

            <div className="tempo-settings-stats-card">
              <div className="tempo-stat-badge">
                <span className="tempo-stat-num">{taskCount}</span>
                <span className="tempo-stat-lbl">{t("tasks", locale)}</span>
              </div>
              <div className="tempo-stat-badge">
                <span className="tempo-stat-num">{projectCount}</span>
                <span className="tempo-stat-lbl">{t("projects", locale)}</span>
              </div>
              <div className="tempo-stat-badge">
                <span className="tempo-stat-num">{cycleCount}</span>
                <span className="tempo-stat-lbl">{t("cycles", locale)}</span>
              </div>
            </div>

            {/* Reset to Sample Data */}
            <div className="tempo-settings-item" style={{ marginTop: 14 }}>
              <div className="tempo-settings-label-group">
                <span className="tempo-settings-item-title">{t("resetData", locale)}</span>
                {confirmReset && (
                  <span className="tempo-settings-item-desc">
                    {tf("resetWarning", locale, { t: taskCount, p: projectCount, c: cycleCount })}
                  </span>
                )}
              </div>

              {!confirmReset ? (
                <button
                  type="button"
                  className="tempo-action-btn"
                  style={{ color: "var(--color-red, #ef4444)" }}
                  onClick={() => setConfirmReset(true)}
                >
                  {t("resetData", locale)}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="tempo-btn-primary"
                    style={{ background: "var(--color-red, #ef4444)", borderColor: "var(--color-red, #ef4444)" }}
                    onClick={() => void handleExecuteReset()}
                    disabled={isResetting}
                  >
                    {t("confirmReset", locale)}
                  </button>
                  <button
                    type="button"
                    className="tempo-action-btn"
                    onClick={() => setConfirmReset(false)}
                  >
                    {t("cancelBtn", locale)}
                  </button>
                </div>
              )}
            </div>

            {/* Export Destination Folder */}
            <div className="tempo-settings-item" style={{ marginTop: 14 }}>
              <div className="tempo-settings-label-group">
                <span className="tempo-settings-item-title">{t("exportFolder", locale)}</span>
                <span className="tempo-settings-item-desc">{t("exportFolderDesc", locale)}</span>
              </div>
              <input
                type="text"
                className="tempo-window-input-title"
                style={{ maxWidth: 220, fontSize: 13, padding: "4px 8px" }}
                placeholder={t("exportFolderPlaceholder", locale)}
                value={exportFolderDraft}
                onInput={(e) => {
                  const val = (e.target as HTMLInputElement).value;
                  setExportFolderDraft(val);
                  onChangeExportFolder?.(val);
                }}
              />
            </div>

            {/* Export a copy of the stored data file */}
            <div className="tempo-settings-item" style={{ marginTop: 14 }}>
              <div className="tempo-settings-label-group">
                <span className="tempo-settings-item-title">{t("exportData", locale)}</span>
                <span className="tempo-settings-item-desc">
                  {exportFolderDraft.trim()
                    ? tf("exportDestInfo", locale, { path: exportFolderDraft.trim() })
                    : t("exportRootInfo", locale)}
                </span>
              </div>
              <button
                type="button"
                className="tempo-action-btn"
                onClick={() => void handleExport()}
                disabled={isExporting}
              >
                {t("exportData", locale)}
              </button>
            </div>

            {resetMessage && (
              <div className={resetFailed ? "tempo-settings-alert-error" : "tempo-settings-alert-success"}
                role={resetFailed ? "alert" : "status"} style={{ marginTop: 8 }}>
                {resetFailed ? "⚠ " : "✓ "}
                {resetMessage}
              </div>
            )}
          </div>

          {/* Section 3: About Crisp Tempo */}
          <div className="tempo-settings-section tempo-about-card" style={{ marginTop: 20 }}>
            <div className="tempo-about-logo">
              <TempoLogoIcon size={28} />
            </div>
            <div className="tempo-about-info">
              <div className="tempo-about-brand">{t("aboutTempo", locale)}</div>
              <div className="tempo-about-slogan">Tasks, in motion.</div>
              <div className="tempo-about-version">
                <span>{tf("aboutVersion", locale, { v: version })}</span>
                <span style={{ margin: "0 6px" }}>·</span>
                <span>{t("authorLabel", locale)}</span>
                <a
                  href="https://xhslink.cn/m/3MwtKu4822b"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tempo-about-author-link"
                >
                  {t("authorLink", locale)}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="tempo-window-footer">
          <div />
          <button
            type="button"
            className="tempo-btn-primary"
            onClick={onClose}
          >
            {t("doneBtn", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
