import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardEditDialog } from "./card-edit-dialog";

const updateCard = vi.fn();
vi.mock("@/lib/actions/cards", () => ({
  updateCard: (input: unknown) => updateCard(input),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const card = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Titulo original",
  description: "Descricao",
  priority: "medium",
  due_date: null,
};

describe("CardEditDialog", () => {
  beforeEach(() => {
    updateCard.mockReset();
    updateCard.mockResolvedValue({ success: true });
  });

  it("pre-fills the form with the card's current values", () => {
    render(
      <CardEditDialog
        open
        onOpenChange={() => {}}
        card={card}
        onSaved={() => {}}
      />
    );
    expect(screen.getByLabelText("Titulo")).toHaveValue("Titulo original");
    expect(screen.getByLabelText("Descricao")).toHaveValue("Descricao");
  });

  it("submits the edited fields to updateCard", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <CardEditDialog
        open
        onOpenChange={() => {}}
        card={card}
        onSaved={onSaved}
      />
    );

    const titleInput = screen.getByLabelText("Titulo");
    await user.clear(titleInput);
    await user.type(titleInput, "Titulo novo");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(updateCard).toHaveBeenCalledTimes(1);
    });
    expect(updateCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: card.id, title: "Titulo novo" })
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("shows a validation error and does not call updateCard for an empty title", async () => {
    const user = userEvent.setup();
    render(
      <CardEditDialog
        open
        onOpenChange={() => {}}
        card={card}
        onSaved={() => {}}
      />
    );

    await user.clear(screen.getByLabelText("Titulo"));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(/obrigat/i)).toBeVisible();
    expect(updateCard).not.toHaveBeenCalled();
  });
});
