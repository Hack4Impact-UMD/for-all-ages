// Add New Participant: takes a name and hands off to the registration form
// at /admin/add-participant, unless the program is full or closed.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const h = vi.hoisted(() => ({
  auth: { programState: null as unknown, programStateLoading: false },
}));

vi.mock("../../src/auth/AuthProvider", () => ({
  useAuth: () => h.auth,
}));

import AddParticipantModal from "../../src/pages/Users/AddParticipantModal";

function RegistrationStub() {
  const location = useLocation();
  return <div>registration for {(location.state as { name?: string })?.name}</div>;
}

function renderModal() {
  render(
    <MemoryRouter initialEntries={["/admin/creator"]}>
      <Routes>
        <Route path="/admin/creator" element={<AddParticipantModal onClose={() => {}} />} />
        <Route path="/admin/add-participant" element={<RegistrationStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

const open = { matches_final: false, started: false, currentParticipants: 3, maxParticipants: 10 };

beforeEach(() => {
  h.auth = { programState: open, programStateLoading: false };
});
afterEach(cleanup);

describe("AddParticipantModal", () => {
  it("passes the trimmed name to the registration form", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Participant name"), { target: { value: "  Ada Lovelace " } });
    fireEvent.click(screen.getByText("Continue to form"));
    expect(screen.getByText("registration for Ada Lovelace")).toBeTruthy();
  });

  it("can't continue without a name", () => {
    renderModal();
    expect((screen.getByText("Continue to form") as HTMLButtonElement).disabled).toBe(true);
  });

  it("blocks when the program is full", () => {
    h.auth = { programState: { ...open, currentParticipants: 10 }, programStateLoading: false };
    renderModal();
    expect(screen.getByText("Program is full.")).toBeTruthy();
    expect((screen.getByLabelText("Participant name") as HTMLInputElement).disabled).toBe(true);
  });
});
