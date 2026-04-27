import React, { useEffect, useRef, useState } from "react";
import type { BannerState, Form, Question, QuestionType } from "../../types";
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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
import RegistrationNew from "../Registration/RegistrationNew";

// labels for the selection

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_input: "Short text",
  medium_input: "Medium text",
  long_input: "Long text",
  Dropdown: "Dropdown",
  DropdownWithOther: "Dropdown with other",
  Slider: "Rating (1-5)",
  Radio: "Radio",
  Date: "Date",
  phoneNumber: "Phone Number",
  text: "Text (display)",
  multiple: "Multi-select pills",
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
        <textarea className={styles.qMockTextarea} />
      )}

      {question.type === "text" && (
        <input className={styles.qMockInput} disabled placeholder="Type..." />
      )}

      {(question.type === "Dropdown" ||
        question.type === "DropdownWithOther") && (
        <div className={styles.qMockSelect}>
          <span className={styles.qMockSelectText}>
            {question.options && question.options.length > 0
              ? "Select..."
              : "Select"}
          </span>
          <span className={styles.qMockSelectArrow}>⌄</span>
        </div>
      )}

      {question.type === "multiple" && (
        <div className={styles.qMockSelect}>
          <span className={styles.qMockSelectText}>Select...</span>
          <span className={styles.qMockSelectArrow}>⌄</span>
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
        <input
          className={styles.qMockInput}
          disabled
          placeholder="(XXX) XXX-XXXX"
        />
      )}
      {question.type === "address" && (
        <input className={styles.qMockInput} disabled placeholder="Address" />
      )}

      {question.type === "profilePicture" && (
        <div className={styles.qMockFile}>📷 Upload photo</div>
      )}
    </div>
  );
}

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
}: InlineEditorProps) {
  return (
    <div className={styles.inlineEditorWrapper}>
      {/* Floating toolbar — compact icons aligned right, hides delete button if locked question */}
      <div className={styles.inlineToolbar}>
        <div className={styles.inlineToolbarActions}>
          <button
            type="button"
            className={`${styles.tbBtn} ${styles.upBtn}`}
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
          >
            < KeyboardArrowUpIcon />
          </button>
          <button
            type="button"
            className={`${styles.tbBtn} ${styles.downBtn}`}
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Move down"
          >
            < KeyboardArrowDownIcon />
          </button>
          {!question.locked && (
            <button
              type="button"
              className={`${styles.tbBtn} ${styles.tbBtnDelete}`}
              onClick={onDelete}
              title="Delete question"
            >
              < DeleteIcon />
            </button>
          )}
        </div>
      </div>

      {/* Blue-bordered editing card */}
      <div
        className={styles.inlineEditorCard}
        onKeyDown={(e) => {
          if (e.key === "Enter") onDone();
        }}
      >
        <input
          className={styles.inlineTitleInput}
          value={question.title ?? ""}
          placeholder="Question Title"
          disabled={question.locked}
          onChange={(e) =>
            e.target.value.length < 100
              ? onUpdate({ title: e.target.value })
              : null
          }
          autoFocus
        />

        <div className={styles.inlineToggles}>
          <input
            className={styles.inlineTypeInput}
            value={question.description ?? ""}
            placeholder="Question Description"
            onChange={(e) =>
              e.target.value.length < 50
                ? onUpdate({ description: e.target.value })
                : null
            }
          />

          <select
            className={styles.questionSelect}
            disabled={question.locked}
            value={question.type}
            onChange={(e) => {
              onUpdate({ type: e.target.value as QuestionType });
            }}
          >
            <option value={""}>Select a question Type</option>
            {(
              Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Options editor for Dropdown / Radio / Multiple */}
        {(question.type === "Dropdown" ||
          question.type === "DropdownWithOther" ||
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
          {(question.type === "short_input" ||
            question.type === "medium_input" ||
            question.type === "long_input" ||
            question.type === "Slider") && (
            <label className={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={question.matchable}
                onChange={(e) => onUpdate({ matchable: e.target.checked })}
              />
              Matchable
            </label>
          )}
        </div>

        <p className={styles.lockedWarning}>
          {question.locked
            ? "This question is required for the program and cannot be removed."
            : ""}
        </p>
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
      <div
        className={`${styles.tabUnderline} ${isActive ? styles.tabUnderlineActive : ""}`}
      />
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
  const activeEditorRef = useRef<HTMLDivElement | null>(null);

  const {
    sections,
    addSection,
    deleteSection,
    updateSectionTitle,
    reorderSections,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    loadForm,
    getForm,
  } = useFormEditor();

  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

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

  // Drag and drop functionality to reorder sections
  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from !== -1 && to !== -1) reorderSections(from, to);
  };

  // Checks to see if each section is valid
  const validateForm = (formToSave: Form) => {
    let valid = true;

    //at least one section
    if (formToSave.sections.length === 0) {
      valid = false;
    }

    //all questions have a title and type
    formToSave.sections.forEach((section) => {
      if (section.questions.length == 0) {
        valid = false;
      }
      section.questions.forEach((question) => {
        if (question.title === "" || question.type == null) {
          valid = false;
        }
      });
    });
    return valid;
  };

  // Function to save to FireBase
  const handleSave = async () => {
    try {
      setSaving(true);
      setBanner(null);
      const formToSave = getForm();

      if (!validateForm(formToSave)) {
        setBanner({
          type: "error",
          message:
            "Please fill out all required fields and have at least 1 question per section.",
        });
        return;
      }

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
  const previewForm = getForm();
  const previewSectionTitle =
    previewForm.sections[activeSectionIndex]?.title ||
    activeSection?.title ||
    `Step ${activeSectionIndex + 1}`;

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

  useEffect(() => {
    if (!resolvedEditingId) return;

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (activeEditorRef.current?.contains(target)) return;
      setEditingQuestionId(null);
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [resolvedEditingId]);

  return (
    <div className={styles.page}>
      {/* Top wrapper for sections  */}
      <div className={styles.blueWrap}>
        {/* Success/error banner */}
        {banner && (
          <div
            className={`${styles.banner} ${
              banner.type === "success"
                ? styles.bannerSuccess
                : styles.bannerError
            }`}
            role="status"
          >
            <span>{banner.message}</span>
            <button
              type="button"
              className={styles.bannerClose}
              onClick={() => setBanner(null)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}
        {/* Program title */}
        <div className={styles.programHeader}>
          <h1 className={styles.programTitle}>Tea @ 3</h1>
          <p className={styles.programSubtitle}>
            This is the form that all users will fill out when they register.
          </p>
        </div>

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
          {isPreviewMode ? (
            <div className={styles.previewPanel}>
              <div className={styles.previewTopRow}>
                <h2 className={styles.previewSectionTitle}>
                  {previewSectionTitle}
                  <span className={styles.previewingHint}> (previewing)</span>
                </h2>
                <button
                  type="button"
                  className={`${styles.previewModeBtn} ${styles.titleRowBtn}`}
                  onClick={() => setIsPreviewMode(false)}
                >
                  <span
                    className={styles.previewModeBtnIcon}
                    aria-hidden="true"
                  >
                    <EditOutlinedIcon fontSize="inherit" />
                  </span>
                  Edit
                </button>
              </div>
              <RegistrationNew
                previewMode
                previewForm={previewForm}
                previewInitialStep={activeSectionIndex}
                compactPreview
                onPreviewStepChange={setActiveSectionIndex}
              />
            </div>
          ) : loading ? (
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
                locked={!!activeSection.locked}
                onPreview={() => setIsPreviewMode(true)}
                onRename={(title) =>
                  updateSectionTitle(activeSection.id, title)
                }
                onDelete={() => {
                  deleteSection(activeSection.id);
                  setEditingQuestionId(null);
                }}
                onCancel={() => {
                  if (savedFormRef.current) loadForm(savedFormRef.current);
                }}
                onSave={handleSave}
                saving={saving}
                canCancel={!!savedFormRef.current}
              />

              {/* Questions */}
              <div className={styles.questionsList}>
                {activeSection.questions.map((q, i) => {
                  const isEditing = resolvedEditingId === q.id;
                  const { id: _id, ...baseQ } = q;

                  if (isEditing) {
                    return (
                      <div key={q.id} ref={activeEditorRef}>
                        <InlineEditor
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
                            if (i > 0) {
                              reorderQuestions(activeSection.id, i, i - 1);
                              setEditingQuestionId(q.id);
                            }
                          }}
                          onMoveDown={() => {
                            if (i < activeSection.questions.length - 1) {
                              reorderQuestions(activeSection.id, i, i + 1);
                              setEditingQuestionId(q.id);
                            }
                          }}
                          onDone={() => setEditingQuestionId(null)}
                        />
                      </div>
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
                {/* Buttons div for: Add question, Go back, Continue */}
                <div className={styles.bottomCenter}>
                  <div className={styles.addQuestionDiv}>
                    {/* "Add question" button */}
                    <button
                      type="button"
                      className={styles.addQuestionBtn}
                      onClick={handleAddQuestion}
                    >
                      <span className={styles.addQuestionPlus}>+</span>
                      Add question
                    </button>
                  </div>

                  <div className={styles.navBtns}>
                    {/* "Go Back" button */}
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

                    {/* "Continue" button */}
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

                {/* "Step x of n" label  */}
                <span className={styles.stepLabel}>
                  Step {activeSectionIndex + 1} of {sections.length}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Section title editor, Cancel/Save buttons, Delete Section button, and Preview button

function SectionTitleEditor({
  section,
  locked,
  onPreview,
  onRename,
  onDelete,
  onCancel,
  onSave,
  saving,
  canCancel,
}: {
  section: EditorSection;
  locked?: boolean;
  onPreview: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  canCancel: boolean;
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
        <div className={styles.inlineToggle}>
          <h2
            className={styles.sectionTitleText}
            onDoubleClick={() => {
              setEditing(true);
              setDraft(section.title ?? "");
            }}
          >
            {section.title || "Untitled Section"}
          </h2>
          <EditIcon
            onClick={() => {
              setEditing(true);
              setDraft(section.title ?? "");
            }}
          />
        </div>
      )}
      <div className={`${styles.sectionTitleActionsRow}`}>
        <button
          type="button"
          className={`${styles.cancelBtn} ${styles.titleRowBtn} ${styles.saveAndCancelBtns}`}
          onClick={onCancel}
          disabled={!canCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.saveBtn}  ${styles.titleRowBtn} ${styles.saveAndCancelBtns}`}
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          className={`${styles.deleteBtn} ${styles.titleRowBtn} ${locked ? styles.sectionTitleActionsDeleteDisabled : ""}`}
          disabled={locked}
          onClick={onDelete}
          title="Delete section"
        >
          <span className={styles.deleteBtnIcon} aria-hidden="true">
            <DeleteOutlineIcon fontSize="inherit" />
          </span>
          Delete Section
        </button>
        <button
          type="button"
          className={`${styles.previewModeBtn} ${styles.titleRowBtn}`}
          onClick={onPreview}
          title="Preview section"
        >
          <span className={styles.previewModeBtnIcon} aria-hidden="true">
            <VisibilityOutlinedIcon fontSize="inherit" />
          </span>
          Preview
        </button>
      </div>
    </div>
  );
}

export default FormBuilder;
