import React, { useEffect, useRef, useState } from "react";
import type { Form, Question, QuestionType } from "../../../types";
import { db } from "../../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { EditorQuestion, EditorSection } from "./useFormEditor";
import { useFormEditor } from "./useFormEditor";
import styles from "./FormBuilder.module.css";

// labels for the selection

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_input: "Short text",
  medium_input: "Medium text",
  long_input: "Long text",
  Dropdown: "Dropdown",
  Slider: "Slider",
  Radio: "Radio",
  Date: "Date",
  phoneNumber: "Phone Number",
  text: "Text (display)",
  multiple: "Multi-select",
  address: "Address",
  profilePicture: "Profile Picture",
};

// previews the questions

function QuestionPreview({ question }: { question: Question }) {
  const isRequired = question.required;

  return (
    <div className={styles.qPreview}>
      <div className={styles.qPreviewLabel}>
        {question.title || (
          <em className={styles.qPreviewPlaceholder}>#Question</em>
        )}
        {isRequired && <span className={styles.qRequired}> *</span>}
      </div>
      {question.description && (
        <div className={styles.qPreviewDesc}>{question.description}</div>
      )}

      {/* Answer input preview */}
      {(question.type === "short_input" ||
        question.type === "medium_input") && (
        <input
          className={styles.qMockInput}
          disabled
          placeholder="Type in your answer..."
        />
      )}
      {question.type === "long_input" && (
        <textarea
          className={styles.qMockTextarea}
          disabled
          placeholder="Type in your answer..."
        />
      )}
      {question.type === "text" && (
        <input className={styles.qMockInput} disabled placeholder="Type..." />
      )}
      {question.type === "Dropdown" && (
        <div className={styles.qMockSelect}>
          <span className={styles.qMockSelectText}>
            {question.options && question.options.length > 0
              ? "Select..."
              : "Select"}
          </span>
          <span className={styles.qMockSelectArrow}>▼</span>
        </div>
      )}
      {question.type === "multiple" && (
        <div className={styles.qMockSelect}>
          <span className={styles.qMockSelectText}>Select...</span>
          <span className={styles.qMockSelectArrow}>▼</span>
        </div>
      )}
      {question.type === "Radio" && (
        <div className={styles.qMockRadioRow}>
          {(question.options ?? ["Option 1", "Option 2", "Option 3"]).map(
            (opt, i) => (
              <label key={i} className={styles.qMockRadioItem}>
                <input type="radio" disabled />
                <span>{opt || `Option ${i + 1}`}</span>
              </label>
            ),
          )}
        </div>
      )}
      {question.type === "Slider" && (
        <input
          type="range"
          className={styles.qMockSlider}
          min={question.min ?? 1}
          max={question.max ?? 5}
          disabled
        />
      )}
      {question.type === "Date" && (
        <input
          className={styles.qMockInput}
          disabled
          placeholder="mm/dd/yyyy"
        />
      )}
      {question.type === "phoneNumber" && (
        <input className={styles.qMockInput} disabled placeholder="+1" />
      )}
      {question.type === "address" && (
        <input
          className={styles.qMockInput}
          disabled
          placeholder="Street Address"
        />
      )}
      {question.type === "profilePicture" && (
        <div className={styles.qMockFile}>📷 Upload photo</div>
      )}
    </div>
  );
}

// question editors

type InlineEditorProps = {
  question: EditorQuestion;
  index: number;
  total: number;
  sectionId: string;
  onUpdate: (updated: Partial<Question>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDone: () => void;
  onUndo: () => void;
  canUndo: boolean;
};

function InlineEditor({
  question,
  index,
  total,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDone,
  onUndo,
  canUndo,
}: InlineEditorProps) {
  const [typeOpen, setTypeOpen] = useState(false);
  const typeSelectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!typeOpen) return;
    const handler = (e: MouseEvent) => {
      if (!typeSelectorRef.current?.contains(e.target as Node)) {
        setTypeOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [typeOpen]);

  const currentTypeLabel = QUESTION_TYPE_LABELS[question.type];

  return (
    <div className={styles.inlineEditorWrapper}>
      {/* Toolbar row above the card */}
      <div className={styles.inlineToolbar}>
        {/* Type selector button */}
        <div ref={typeSelectorRef} className={styles.typeSelectorWrap}>
          <button
            type="button"
            className={`${styles.tbBtn} ${styles.typeSelectorBtn}`}
            onClick={() => setTypeOpen((o) => !o)}
            title="Question type"
          >
            {currentTypeLabel}
            <span className={styles.typeSelectorArrow}>▾</span>
          </button>
          {typeOpen && (
            <div className={styles.typeDropdown}>
              {(
                Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.typeDropdownItem} ${value === question.type ? styles.typeDropdownItemActive : ""}`}
                  onClick={() => {
                    onUpdate({ type: value });
                    setTypeOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.inlineToolbarActions}>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={onDone}
            title="Done editing"
          >
            ✓
          </button>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
          >
            ↩
          </button>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
          >
            ∧
          </button>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Move down"
          >
            ∨
          </button>
          <button
            type="button"
            className={`${styles.tbBtn} ${styles.tbBtnDelete}`}
            onClick={onDelete}
            title="Delete question"
          >
            X
          </button>
        </div>
      </div>

      {/* Blue-bordered editing card */}
      <div className={styles.inlineEditorCard}>
        <input
          className={styles.inlineTitleInput}
          value={question.title ?? ""}
          placeholder="#Question"
          onChange={(e) => onUpdate({ title: e.target.value })}
          autoFocus
        />
        <input
          className={styles.inlineTypeInput}
          value={question.description ?? ""}
          placeholder="Type"
          onChange={(e) => onUpdate({ description: e.target.value })}
        />

        {/* Options editor for Dropdown / Radio / Multiple */}
        {(question.type === "Dropdown" ||
          question.type === "Radio" ||
          question.type === "multiple") && (
          <div className={styles.inlineOptionsBlock}>
            {(question.options ?? []).map((opt, i) => (
              <div key={i} className={styles.inlineOptionRow}>
                <input
                  className={styles.inlineOptionInput}
                  value={opt}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) => {
                    const next = [...(question.options ?? [])];
                    next[i] = e.target.value;
                    onUpdate({ options: next });
                  }}
                />
                <button
                  type="button"
                  className={styles.inlineOptionRemove}
                  onClick={() => {
                    const next = (question.options ?? []).filter(
                      (_, j) => j !== i,
                    );
                    onUpdate({ options: next.length ? next : [""] });
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.inlineAddOption}
              onClick={() =>
                onUpdate({ options: [...(question.options ?? []), ""] })
              }
            >
              + Add answer
            </button>
          </div>
        )}

        {/* Slider range */}
        {question.type === "Slider" && (
          <div className={styles.inlineRangeRow}>
            <label className={styles.inlineRangeLabel}>
              Min
              <input
                type="number"
                className={styles.inlineRangeInput}
                value={question.min ?? 1}
                onChange={(e) => onUpdate({ min: Number(e.target.value) })}
              />
            </label>
            <label className={styles.inlineRangeLabel}>
              Max
              <input
                type="number"
                className={styles.inlineRangeInput}
                value={question.max ?? 5}
                onChange={(e) => onUpdate({ max: Number(e.target.value) })}
              />
            </label>
          </div>
        )}

        {/* Required / Matchable toggles */}
        <div className={styles.inlineToggles}>
          <label className={styles.inlineToggle}>
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
            />
            Required
          </label>
          <label className={styles.inlineToggle}>
            <input
              type="checkbox"
              checked={question.matchable}
              onChange={(e) => onUpdate({ matchable: e.target.checked })}
            />
            Matchable
          </label>
        </div>
      </div>
    </div>
  );
}

function SectionTab({
  section,
  index,
  isActive,
  onActivate,
}: {
  section: EditorSection;
  index: number;
  isActive: boolean;
  onActivate: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.tabOuter}>
      <button
        type="button"
        className={`${styles.tabCircle} ${isActive ? styles.tabCircleActive : ""}`}
        onClick={onActivate}
        {...attributes}
        {...listeners}
      >
        {index + 1}
      </button>
      <span
        className={`${styles.tabLabel} ${isActive ? styles.tabLabelActive : ""}`}
      >
        {section.title || "Untitled"}
      </span>
    </div>
  );
}

const FormBuilder: React.FC = () => {
  const savedFormRef = useRef<Form | null>(null);

  const {
    sections,
    canUndo,
    addSection,
    deleteSection,
    updateSectionTitle,
    reorderSections,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    undo,
    loadForm,
    getForm,
  } = useFormEditor();

  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Which question id is currently being edited inline (null = none)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Keep activeSectionIndex in bounds when sections change
  useEffect(() => {
    if (activeSectionIndex >= sections.length && sections.length > 0) {
      setActiveSectionIndex(sections.length - 1);
    }
  }, [sections.length, activeSectionIndex]);

  // Load form from Firestore on mount
  useEffect(() => {
    const fetchForm = async () => {
      try {
        const ref = doc(db, "config", "registrationForm");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const formData = snap.data() as Form;
          savedFormRef.current = formData;
          loadForm(formData);
        }
      } catch (err) {
        console.error("Failed to load form", err);
        setBanner({
          type: "error",
          message: "Failed to load form configuration.",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [loadForm]);

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from !== -1 && to !== -1) reorderSections(from, to);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setBanner(null);
      const formToSave = getForm();
      await setDoc(doc(db, "config", "registrationForm"), formToSave, {
        merge: false,
      });
      savedFormRef.current = formToSave;
      setBanner({ type: "success", message: "Form saved successfully." });
    } catch (err) {
      console.error("Failed to save form", err);
      setBanner({
        type: "error",
        message: "Failed to save. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const activeSection: EditorSection | null =
    sections[activeSectionIndex] ?? null;

  const handleAddQuestion = () => {
    if (!activeSection) return;
    addQuestion(activeSection.id);
    // After adding, the new question will be last — open it for editing
    // We use a microtask so the state has updated first
    setTimeout(() => {
      setEditingQuestionId("__last__");
    }, 0);
  };

  // Resolve "__last__" sentinel to the actual last question id
  const resolveEditingId = (section: EditorSection | null): string | null => {
    if (!section) return null;
    if (editingQuestionId === "__last__") {
      const last = section.questions[section.questions.length - 1];
      return last?.id ?? null;
    }
    return editingQuestionId;
  };

  const updateQuestionField = (
    sectionId: string,
    questionId: string,
    partial: Partial<Question>,
  ) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const q = section.questions.find((q) => q.id === questionId);
    if (!q) return;
    const { id: _id, ...base } = q;
    updateQuestion(sectionId, questionId, { ...base, ...partial });
  };

  const resolvedEditingId = resolveEditingId(activeSection);

  return (
    <div className={styles.page}>
      {/* IMPORTANT!! TODO: TO BE REPLACED */}
      <header className={styles.topBar}>
        <div className={styles.topBarLogo}>
          <span className={styles.topBarLogoIcon}>🌿</span>
          <span className={styles.topBarLogoText}>For All Ages</span>
        </div>
        <div className={styles.topBarCenter}>
          <span className={styles.topBarPill}>Edit Form</span>
        </div>
        <div className={styles.topBarActions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => {
              if (savedFormRef.current) loadForm(savedFormRef.current);
            }}
            disabled={!savedFormRef.current}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {/* Success/error banner */}
      {banner && (
        <div
          className={`${styles.banner} ${
            banner.type === "success"
              ? styles.bannerSuccess
              : styles.bannerError
          }`}
        >
          {banner.message}
          <button
            type="button"
            className={styles.bannerClose}
            onClick={() => setBanner(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top wrapper for sections  */}
      <div className={styles.blueWrap}>
        {/* Section tabs card */}
        <div className={styles.tabsCard}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className={styles.tabsRow}>
                {sections.map((s, i) => (
                  <React.Fragment key={s.id}>
                    <SectionTab
                      section={s}
                      index={i}
                      isActive={activeSectionIndex === i}
                      onActivate={() => {
                        setActiveSectionIndex(i);
                        setEditingQuestionId(null);
                      }}
                    />
                    <div className={styles.tabConnector} />
                  </React.Fragment>
                ))}

                {/* Add New Section — no connector after */}
                <div className={styles.tabOuter}>
                  <button
                    type="button"
                    className={styles.tabCircleAdd}
                    onClick={() => {
                      addSection();
                      setActiveSectionIndex(sections.length);
                      setEditingQuestionId(null);
                    }}
                    title="Add new section"
                  >
                    +
                  </button>
                  <span className={styles.tabLabel}>Add New Section</span>
                </div>
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Section content card */}
        <div className={styles.contentCard}>
          {loading ? (
            <div className={styles.loadingState}>
              Loading registration form…
            </div>
          ) : !activeSection ? (
            <div className={styles.emptyState}>
              <p>No sections yet.</p>
              <button
                type="button"
                className={styles.emptyAddBtn}
                onClick={() => {
                  addSection();
                  setActiveSectionIndex(0);
                }}
              >
                + Add your first section
              </button>
            </div>
          ) : (
            <>
              {/* Section title */}
              <SectionTitleEditor
                section={activeSection}
                onRename={(title) =>
                  updateSectionTitle(activeSection.id, title)
                }
                onDelete={() => {
                  deleteSection(activeSection.id);
                  setEditingQuestionId(null);
                }}
              />

              {/* Questions */}
              <div className={styles.questionsList}>
                {activeSection.questions.map((q, i) => {
                  const isEditing = resolvedEditingId === q.id;
                  const { id: _id, ...baseQ } = q;

                  if (isEditing) {
                    return (
                      <InlineEditor
                        key={q.id}
                        question={q}
                        index={i}
                        total={activeSection.questions.length}
                        sectionId={activeSection.id}
                        onUpdate={(partial) =>
                          updateQuestionField(activeSection.id, q.id, partial)
                        }
                        onDelete={() => {
                          deleteQuestion(activeSection.id, q.id);
                          setEditingQuestionId(null);
                        }}
                        onMoveUp={() => {
                          if (i > 0)
                            reorderQuestions(activeSection.id, i, i - 1);
                        }}
                        onMoveDown={() => {
                          if (i < activeSection.questions.length - 1)
                            reorderQuestions(activeSection.id, i, i + 1);
                        }}
                        onDone={() => setEditingQuestionId(null)}
                        onUndo={undo}
                        canUndo={canUndo}
                      />
                    );
                  }

                  return (
                    <div
                      key={q.id}
                      className={styles.questionPreviewWrapper}
                      onClick={() => setEditingQuestionId(q.id)}
                      title="Click to edit"
                    >
                      <QuestionPreview question={baseQ} />
                    </div>
                  );
                })}
              </div>

              {/* Bottom nav */}
              <div className={styles.bottomBar}>
                <div className={styles.bottomLeft}>
                  <button
                    type="button"
                    className={styles.addQuestionBtn}
                    onClick={handleAddQuestion}
                  >
                    <span className={styles.addQuestionPlus}>+</span>
                    Add question
                  </button>
                </div>

                <div className={styles.bottomCenter}>
                  <span className={styles.stepLabel}>
                    Step {activeSectionIndex + 1} of {sections.length}
                  </span>
                  <div className={styles.navBtns}>
                    <button
                      type="button"
                      className={styles.navBtn}
                      onClick={() =>
                        setActiveSectionIndex((i) => Math.max(0, i - 1))
                      }
                      disabled={activeSectionIndex === 0}
                    >
                      Go Back
                    </button>
                    <button
                      type="button"
                      className={`${styles.navBtn} ${styles.navBtnPrimary}`}
                      onClick={() =>
                        setActiveSectionIndex((i) =>
                          Math.min(sections.length - 1, i + 1),
                        )
                      }
                      disabled={activeSectionIndex === sections.length - 1}
                    >
                      Continue
                    </button>
                  </div>
                </div>

                <div className={styles.bottomRight} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Section title editor

function SectionTitleEditor({
  section,
  onRename,
  onDelete,
}: {
  section: EditorSection;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.title ?? "");

  const commit = () => {
    setEditing(false);
    onRename(draft.trim() || "Untitled Section");
  };

  return (
    <div className={styles.sectionTitleRow}>
      {editing ? (
        <input
          className={styles.sectionTitleInput}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(section.title ?? "");
            }
          }}
        />
      ) : (
        <h2
          className={styles.sectionTitleText}
          onDoubleClick={() => {
            setEditing(true);
            setDraft(section.title ?? "");
          }}
        >
          {section.title || "Untitled Section"}
        </h2>
      )}
      <div className={styles.sectionTitleActions}>
        <button
          type="button"
          className={styles.sectionActionBtn}
          onClick={() => {
            setEditing(true);
            setDraft(section.title ?? "");
          }}
          title="Rename"
        >
          Edit
        </button>
        <button
          type="button"
          className={`${styles.sectionActionBtn} ${styles.sectionDeleteBtn}`}
          onClick={onDelete}
          title="Delete section"
        >
          X
        </button>
      </div>
    </div>
  );
}

export default FormBuilder;
