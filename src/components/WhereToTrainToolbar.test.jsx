import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import DarbakAssistant from "./DarbakAssistant";
import SavedItemsDrawer from "./SavedItemsDrawer";

jest.mock("axios", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));
jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: "/where-to-train" }),
  useNavigate: () => jest.fn(),
}));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../utils/savedItems", () => ({
  getSavedItems: () => [{ id: "opportunity:one", type: "opportunity", title: "فرصة" }],
  markSavedItemOrganizationUpdatesSeen: jest.fn(),
  toggleSavedItem: jest.fn(),
}));

beforeEach(() => {
  axios.post.mockResolvedValue({ data: { updates: [] } });
});

test("assistant moves into the toolbar when the lazy page mounts", async () => {
  const { unmount } = render(<DarbakAssistant />);
  const toolbar = document.createElement("div");
  toolbar.id = "where-to-train-tools";
  document.body.appendChild(toolbar);

  await waitFor(() =>
    expect(within(toolbar).getByRole("button", { name: /دليل دربك/ })).toBeInTheDocument()
  );
  expect(document.querySelector(".darbak-assistant-widget .darbak-assistant-trigger")).toBeNull();
  unmount();
  toolbar.remove();
});

test("saved items moves into the toolbar when the lazy page mounts", async () => {
  const { unmount } = render(<SavedItemsDrawer />);
  expect(screen.getByRole("button", { name: /متابعاتي/ })).toBeInTheDocument();
  const toolbar = document.createElement("div");
  toolbar.id = "where-to-train-tools";
  document.body.appendChild(toolbar);

  await waitFor(() =>
    expect(within(toolbar).getByRole("button", { name: /متابعاتي/ })).toBeInTheDocument()
  );
  expect(document.querySelector(".saved-items-widget .saved-items-trigger")).toBeNull();
  unmount();
  toolbar.remove();
});
