// A returning participant opens registration: unchanged answers come back as
// the inputs' initial values, changed questions start blank, and a banner
// says so. A brand-new user gets an empty form and no banner.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({
  docs: {} as Record<string, Record<string, unknown> | undefined>,
  auth: {} as Record<string, unknown>,
}));

vi.mock("../../src/auth/AuthProvider", () => ({ useAuth: () => h.auth }));
vi.mock("../../src/firebase", () => ({ db: {}, upsertUser: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  doc: (_db: unknown, col?: string, id?: string) => ({ path: `${col}/${id}`, id: "new-id" }),
  getDoc: async (ref: { path: string }) => {
    const data = h.docs[ref.path];
    return { exists: () => data !== undefined, data: () => data };
  },
  setDoc: vi.fn(),
  serverTimestamp: () => null,
  runTransaction: vi.fn(),
  increment: () => null,
}));

import RegistrationNew from "../../src/pages/Registration/RegistrationNew";

const form = {
  sections: [
    {
      title: "About you",
      questions: [
        { type: "short_input", title: "Name", required: false, matchable: false },
        { type: "phoneNumber", title: "Phone", required: false, matchable: false },
        { type: "Dropdown", title: "Tea", options: ["Green", "Black"], required: false, matchable: true },
        // Options changed since the participant answered.
        { type: "Radio", title: "Coffee", options: ["Yes", "No", "Sometimes"], required: false, matchable: false },
        { type: "multiple", title: "Contact", options: ["Phone", "Email"], required: false, matchable: false },
        { type: "long_input", title: "Brand new question", required: false, matchable: true },
      ],
    },
  ],
};

const savedAnswers = {
  uid: "u1",
  questions: [
    { title: "Tea", type: "Dropdown", answer: "Black", options: ["Green", "Black"] },
    { title: "Coffee", type: "Radio", answer: "Yes", options: ["Yes", "No"] },
    { title: "Contact", type: "multiple", answer: "Phone, Email", options: ["Phone", "Email"] },
  ],
};

function renderForm() {
  return render(
    <MemoryRouter initialEntries={["/registration"]}>
      <RegistrationNew />
    </MemoryRouter>,
  );
}

const field = (container: HTMLElement, name: string) =>
  container.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement;

beforeEach(() => {
  h.auth = {
    user: { uid: "u1", email: "ada@example.com", displayName: null },
    loading: false,
    programState: { matches_final: false },
    programStateLoading: false,
  };
  h.docs = { "config/registrationForm": form };
});
afterEach(cleanup);

describe("RegistrationNew prefill", () => {
  it("prefills unchanged answers for a returning participant", async () => {
    h.docs["participants/u1"] = {
      displayName: "Ada Lovelace",
      phoneNumber: "3015550100",
      role: "Participant",
    };
    h.docs["FormResponse/u1"] = savedAnswers;

    const { container } = renderForm();
    await screen.findByText(/Welcome back!/);

    expect(field(container, "s0_q0").value).toBe("Ada Lovelace");
    expect(field(container, "s0_q1").value).toBe("3015550100");
    expect(field(container, "s0_q1_confirm").value).toBe("3015550100");
    expect(field(container, "s0_q2").value).toBe("Black");

    const coffee = container.querySelectorAll<HTMLInputElement>('[name="s0_q3"]');
    expect([...coffee].some((r) => r.checked)).toBe(false);

    const contact = container.querySelectorAll<HTMLInputElement>('[name="s0_q4"]');
    expect([...contact].map((c) => c.checked)).toEqual([true, true]);

    expect(field(container, "s0_q5").value).toBe("");
  });

  it("prefills from an orphaned FormResponse with no participant doc", async () => {
    h.docs["FormResponse/u1"] = savedAnswers;
    const { container } = renderForm();
    await screen.findByText(/Welcome back!/);
    expect(field(container, "s0_q0").value).toBe("");
    expect(field(container, "s0_q2").value).toBe("Black");
  });

  it("shows an empty form and no banner to a brand-new user", async () => {
    const { container } = renderForm();
    await waitFor(() => expect(field(container, "s0_q0")).toBeTruthy());
    expect(screen.queryByText(/Welcome back!/)).toBeNull();
    expect(field(container, "s0_q0").value).toBe("");
    expect(field(container, "s0_q2").value).toBe("");
  });
});
