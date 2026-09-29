import type { JSX } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { getTodayString } from "../../services/date-service";
import { t, tf, type Locale } from "../../services/i18n";
import { installDialogFocus } from "../components/dialog-focus";
import { DatePickerPopover } from "../components/DatePickerPopover";
import { CloseIcon, CycleIcon } from "../icons/Icons";

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export interface CycleModalProps {
  isOpen: boolean;
  locale: Locale;
  nextCycleNumber?: number;
  currentCycleEnd?: string;
  /** Present when editing an existing cycle; the modal then saves instead of creating. */
  initial?: { title: string; startDate: string; endDate: string; status: string };
  /** Tasks that will be unlinked if the cycle is deleted. */
  linkedTaskCount?: number;
  onDeleteCycle?: () => void;
  onClose: () => void;
  onCreateCycle: (cycle: {
    title: string;
    startDate: string;
    endDate: string;
    status: "current" | "upcoming";
  }) => void;
}

export function CycleModal({
  isOpen,
  locale,
  nextCycleNumber = 2,
  currentCycleEnd,
  initial,
  linkedTaskCount = 0,
  onDeleteCycle,
  onClose,
  onCreateCycle,
}: CycleModalProps): JSX.Element | null {
  const today = getTodayString();
  const isEdit = !!initial;
  const defaultStart = initial?.startDate ??
    (currentCycleEnd && currentCycleEnd >= today ? shiftDate(currentCycleEnd, 1) : today);
  const defaultEnd = initial?.endDate ?? shiftDate(defaultStart, 6);
  const defaultStatus: "current" | "upcoming" = defaultStart > today ? "upcoming" : "current";
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState(
    () => initial?.title ?? tf("cycleDefaultTitle", locale, { n: nextCycleNumber }),
  );
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [status, setStatus] = useState<"current" | "upcoming">(defaultStatus);
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

  const [dateError, setDateError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const handleSubmit = () => {
    if (isSubmittingRef.current) return;
    const trimmed = title.trim();
    if (!trimmed) return;

    if (!startDate || !endDate) {
      setDateError(t("datesRequired", locale));
      return;
    }
    const start = startDate;
    const end = endDate;

    if (start > end) {
      setDateError(t("startAfterEnd", locale));
      return;
    }
    setDateError(null);

    isSubmittingRef.current = true;
    onCreateCycle({
      title: trimmed,
      startDate: start,
      endDate: end,
      status,
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
            <CycleIcon size={16} />
            <span className="tempo-window-title">{t(isEdit ? "editCycle" : "newCycle", locale)}</span>
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
          {/* Cycle Title */}
          <div className="tempo-window-field">
            <label className="tempo-field-label">{t("cycleTitle", locale)}</label>
            <input
              ref={inputRef}
              type="text"
              className="tempo-window-input-title"
              placeholder={t("cycleTitlePlaceholder", locale)}
              value={title}
              onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Date Range Inputs */}
          <div className="tempo-window-field-row" style={{ marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="tempo-field-label">{t("startDate", locale)}</label>
              <DatePickerPopover
                value={startDate}
                locale={locale}
                align="left"
                placement="bottom"
                onChange={(d) => {
                  setStartDate(d || "");
                  setDateError(null);
                  // Keep the status consistent with the dates; it can still be overridden.
                  if (d) setStatus(d > today ? "upcoming" : "current");
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="tempo-field-label">{t("endDate", locale)}</label>
              <DatePickerPopover
                value={endDate}
                locale={locale}
                align="right"
                placement="bottom"
                onChange={(d) => {
                  setEndDate(d || "");
                  setDateError(null);
                }}
              />
            </div>
          </div>

          {dateError && (
            <div style={{ color: "var(--color-red, #ef4444)", fontSize: 12, marginTop: 6, fontWeight: 500 }}>
              ⚠ {dateError}
            </div>
          )}

          {/* Status Selection */}
          <div className="tempo-window-field" style={{ marginTop: 12 }}>
            <label className="tempo-field-label">{t("cycleStatus", locale)}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`tempo-pill-btn ${status === "current" ? "is-active" : ""}`}
                onClick={() => setStatus("current")}
              >
                <span>{t("cycleCurrent", locale)}</span>
              </button>
              <button
                type="button"
                className={`tempo-pill-btn ${status === "upcoming" ? "is-active" : ""}`}
                onClick={() => setStatus("upcoming")}
              >
                <span>{t("cycleUpcoming", locale)}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="tempo-window-footer">
          {isEdit && onDeleteCycle ? (
            <button
              type="button"
              className="tempo-action-btn tempo-btn-danger-text"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                onDeleteCycle();
                onClose();
              }}
            >
              {confirmDelete
                ? tf("confirmDeleteCycle", locale, { n: linkedTaskCount })
                : t("deleteCycle", locale)}
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
              {t(isEdit ? "saveBtn" : "createCycle", locale)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
