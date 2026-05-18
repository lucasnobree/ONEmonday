import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterSelect } from "./filter-select";

const options = [
  { value: "all", label: "Todo porte" },
  { value: "micro", label: "Micro" },
  { value: "large", label: "Grande" },
];

describe("FilterSelect", () => {
  it("renders the localized label of the selected value, not the raw token", () => {
    // Regression: Base UI's unformatted Select.Value painted the literal
    // "all" token on the trigger. The trigger must show the option label.
    render(
      <FilterSelect
        value="all"
        onValueChange={() => {}}
        options={options}
        aria-label="Filtrar por porte"
      />
    );
    const trigger = screen.getByLabelText("Filtrar por porte");
    expect(trigger).toHaveTextContent("Todo porte");
    expect(trigger).not.toHaveTextContent(/^all$/);
  });

  it("renders the label for a non-sentinel selected value", () => {
    render(
      <FilterSelect
        value="micro"
        onValueChange={() => {}}
        options={options}
        aria-label="Filtrar por porte"
      />
    );
    expect(screen.getByLabelText("Filtrar por porte")).toHaveTextContent(
      "Micro"
    );
  });

  it("falls back to the raw value when no option matches", () => {
    render(
      <FilterSelect
        value="legacy"
        onValueChange={() => {}}
        options={options}
        aria-label="Filtrar por porte"
      />
    );
    expect(screen.getByLabelText("Filtrar por porte")).toHaveTextContent(
      "legacy"
    );
  });

  it("reports the chosen value through onValueChange", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterSelect
        value="all"
        onValueChange={onValueChange}
        options={options}
        aria-label="Filtrar por porte"
      />
    );
    await user.click(screen.getByLabelText("Filtrar por porte"));
    await user.click(await screen.findByRole("option", { name: "Grande" }));
    expect(onValueChange).toHaveBeenCalledWith("large");
  });
});
