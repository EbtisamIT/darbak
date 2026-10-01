import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import StudentFeedbackControls from "./StudentFeedbackControls";

const props = {
  tab: "written", pagination: { page: 1, limit: 30, total: 67, totalPages: 3 },
  loading: false, colors: {}, onTabChange: jest.fn(), onPageChange: jest.fn(),
};
beforeEach(() => jest.clearAllMocks());

test("offers older feedback beyond 30 and shows filtered total", () => {
  render(<StudentFeedbackControls {...props} />);
  expect(screen.getByRole("status")).toHaveTextContent("عرض 1–30 من 67 ردًا");
  expect(screen.getByRole("button", { name: "الأحدث" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "الأقدم" }));
  expect(props.onPageChange).toHaveBeenCalledWith(2);
  expect(screen.getByRole("button", { name: "آراء مكتوبة" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "كل الردود" }));
  expect(props.onTabChange).toHaveBeenCalledWith("all");
});

test("last page can go back, cannot exceed the last page", () => {
  render(<StudentFeedbackControls {...props} pagination={{ ...props.pagination, page: 3 }} />);
  expect(screen.getByRole("status")).toHaveTextContent("عرض 61–67 من 67 ردًا");
  expect(screen.getByRole("button", { name: "الأقدم" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "الأحدث" }));
  expect(props.onPageChange).toHaveBeenCalledWith(2);
});

test("loading disables navigation and empty results do not show bogus ranges", () => {
  const { rerender } = render(<StudentFeedbackControls {...props} loading />);
  screen.getAllByRole("button").forEach((button) => expect(button).toBeDisabled());
  expect(screen.getByRole("status")).toHaveTextContent("جارٍ تحميل الآراء");
  rerender(<StudentFeedbackControls {...props} pagination={{ page: 1, limit: 30, total: 0, totalPages: 1 }} />);
  expect(screen.getByRole("status")).toHaveTextContent("عرض 0–0 من 0 ردًا");
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});
