import type { JSX } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { t, tf, type Locale } from "../../services/i18n";
import { installDialogFocus } from "../components/dialog-focus";
import { CloseIcon, FolderPlusIcon } from "../icons/Icons";

const PRESET_COLORS = [
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#0eb39e", // Teal / Mint
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f97316", // Orange
  "#ef4444", // Red / Coral
  "#ec4899", // Pink / Magenta
  "#8b5cf6", // Purple
];

export interface ProjectModalProps {
  isOpen: boolean;
  locale: Locale;
  /** Present when editing an existing project; the modal then saves instead of creating. */
  initial?: { title: string; color?: string; description?: string };
  /** Tasks that will be unlinked if the project is deleted. */
  linkedTaskCount?: number;
  onDeleteProject?: () => void;
  onClose: () => void;
  onCreateProject: (project: {
    title: string;
    color: string;
    description?: string;
  }) => void;
}

export function ProjectModal({
  isOpen,
  locale,
  initial,
  linkedTaskCount = 0,
  onDeleteProject,
  onClose,
  onCreateProject,
}: ProjectModalProps): JSX.Element | null {
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [color, setColor] = useState(initial?.color || PRESET_COLORS[0]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const removeKeyboard = installDialogFocus(card, onClose);
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      clearTimeout(focusTimer);
      removeKeyboard();
    };
  }, []);

  const isSubmittingRef = useRef(false);

  const handleSubmit = () => {
    if (isSubmittingRef.current) return;
    const trimmed = title.trim();
    if (!trimmed) return;

    isSubmittingRef.current = true;
    onCreateProject({
      title: trimmed,
      color,
      description: description.trim() || undefined,
    });

    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.isComposing || (e as any).keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSubmit();
    }
  };

  // The guard sits after every hook so the hook order cannot change between renders.
  if (!isOpen) return null;

  return (
    <div
      className="tempo-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tempo-window-card" ref={cardRef} style={{ maxWidth: 460 }}>
        {/* Titlebar */}
        <div className="tempo-window-header">
          <div className="tempo-window-title-left">
            <FolderPlusIcon size={16} />
            <span className="tempo-window-title">
              {t(isEdit ? "editProject" : "newProject", locale)}
            </span>
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

        {/* Form Body */}
        <div className="tempo-window-body">
          {/* Project Name */}
          <div className="tempo-window-field">
            <label className="tempo-field-label">{t("projectTitle", locale)}</label>
            <input
              ref={inputRef}
              type="text"
              className="tempo-window-input-title"
              placeholder={t("projectTitlePlaceholder", locale)}
              value={title}
              onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Color Palette */}
          <div className="tempo-window-field" style={{ marginTop: 12 }}>
            <label className="tempo-field-label">{t("projectColor", locale)}</label>
            <div className="tempo-color-palette">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`tempo-color-dot-btn ${color === c ? "is-selected" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="tempo-window-field" style={{ marginTop: 12 }}>
            <label className="tempo-field-label">{t("projectDesc", locale)}</label>
            <textarea
              className="tempo-window-textarea"
              rows={2}
              placeholder={t("projectDescPlaceholder", locale)}
              value={description}
              onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="tempo-window-footer">
          {isEdit && onDeleteProject ? (
            <button
              type="button"
              className="tempo-action-btn tempo-btn-danger-text"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                onDeleteProject();
                onClose();
              }}
            >
              {confirmDelete
                ? tf("confirmDeleteProject", locale, { n: linkedTaskCount })
                : t("deleteProject", locale)}
            </button>
          ) : (
            <div className="tempo-window-hint">{t("shortcutHint", locale)}</div>
          )}
          <div className="tempo-window-actions">
            <button
              type="button"
              className="tempo-action-btn"
              onClick={onClose}
            >
              {t("cancelBtn", locale)}
            </button>
            <button
              type="button"
              className="tempo-btn-primary"
              onClick={handleSubmit}
              disabled={!title.trim()}
            >
              {t(isEdit ? "saveBtn" : "createProject", locale)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
