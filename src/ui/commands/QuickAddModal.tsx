import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Project } from "../../core/types";
import { getTodayString } from "../../services/date-service";
import { t, type Locale } from "../../services/i18n";
import { InboxIcon, TodayIcon } from "../icons/Icons";

interface QuickAddModalProps {
  isOpen: boolean;
  locale: Locale;
  projects: Record<string, Project>;
  onClose: () => void;
  onAddTask: (task: {
    title: string;
    triage: "inbox" | "processed";
    focusDate?: string;
    projectId?: string;
  }) => void;
}

export function QuickAddModal({
  isOpen,
  locale,
  projects,
  onClose,
  onAddTask,
}: QuickAddModalProps): JSX.Element | null {
  if (!isOpen) return null;

  const [title, setTitle] = useState("");
  const [dest, setDest] = useState<"inbox" | "today">("inbox");
  const [selectedProj, setSelectedProj] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      const onGlobalKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener("keydown", onGlobalKey);
      return () => window.removeEventListener("keydown", onGlobalKey);
    } else {
      setTitle("");
      setDest("inbox");
      setSelectedProj("");
    }
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    onAddTask({
      title: trimmed,
      triage: dest === "today" ? "processed" : "inbox",
      focusDate: dest === "today" ? getTodayString() : undefined,
      projectId: selectedProj || undefined,
    });

    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="tempo-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tempo-quick-card">
        <input
          ref={inputRef}
          type="text"
          className="tempo-quick-input"
          placeholder={t("quickAddPlaceholder", locale)}
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
        />

        <div className="tempo-quick-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              className={`tempo-pill-btn ${dest === "inbox" ? "is-active" : ""}`}
              onClick={() => setDest("inbox")}
            >
              <InboxIcon size={12} />
              <span>{t("inbox", locale)}</span>
            </button>
            <button
              type="button"
              className={`tempo-pill-btn ${dest === "today" ? "is-active" : ""}`}
              onClick={() => setDest("today")}
            >
              <TodayIcon size={12} />
              <span>{t("today", locale)}</span>
            </button>

            <select
              className="tempo-property-select"
              value={selectedProj}
              onChange={(e) => setSelectedProj((e.target as HTMLSelectElement).value)}
              style={{ width: "auto", minWidth: 100 }}
            >
              <option value="">{t("noProject", locale)}</option>
              {Object.values(projects).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="tempo-btn-primary"
            onClick={handleSubmit}
          >
            {t("createBtn", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
