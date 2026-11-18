import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import LandingNavbar from "@/components/landing/LandingNavbar";
import RolePreview from "@/components/landing/RolePreview";

describe("Landing page interactions", () => {
  it("switches previews and sends privileged roles to login", () => {
    render(<MemoryRouter><RolePreview /></MemoryRouter>);

    for (const [tab, link, role] of [
      ["For builders", "Start building", "student"],
      ["For organizers", "Host your hackathon", "admin"],
      ["For judges", "Join as a judge", "judge"],
    ]) {
      fireEvent.mouseDown(screen.getByRole("tab", { name: tab }), { button: 0, ctrlKey: false });
      const panel = screen.getByRole("tabpanel");
      expect(within(panel).getByRole("link", { name: link })).toHaveAttribute("href", `/auth/${role !== "student" ? "login" : "signup"}?role=${role}`);
      expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    }
  });

  it("closes mobile navigation after selecting a section", () => {
    render(<MemoryRouter><LandingNavbar dashboardLink={null} onLogout={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("link", { name: "How it works" }));
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  });
});
