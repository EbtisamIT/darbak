import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import SearchDiscoveryReport from "./SearchDiscoveryReport";

test("shows classifications and rejection reasons without converting snippets into adverts", () => {
  render(<SearchDiscoveryReport report={{ queries: [{ query: "COOP Saudi Arabia", count: 2, code: "SEARCH_COMPLETED" }], results: [
    { url: "https://official.example/job/1", title: "Internship", classification: "official_company", accepted: true, reason: "OFFICIAL_TRAINING_HINT_REQUIRES_EXTRACTION", discoveredByQueries: ["COOP Saudi Arabia"] },
    { url: "https://unknown.example/job/2", title: "COOP", classification: "unknown", accepted: false, reason: "SOURCE_SCOPE_NOT_APPROVED" },
  ] }} />);
  expect(screen.getByText("شركة رسمية")).toBeVisible();
  expect(screen.getByText(/لن يُجلب تلقائيًا/)).toBeVisible();
  expect(screen.getByText("SOURCE_SCOPE_NOT_APPROVED")).toBeVisible();
  expect(screen.getByRole("link", { name: "Internship" })).toHaveAttribute("href", "https://official.example/job/1");
});
test("paginates results without a large page", () => {
  render(<SearchDiscoveryReport report={{ results: Array.from({ length: 21 }, (_, i) => ({ url: `https://official.example/${i}`, title: `Result ${i}` })) }} />);
  expect(screen.queryByText("Result 20")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "التالي" }));
  expect(screen.getByText("Result 20")).toBeVisible();
});
