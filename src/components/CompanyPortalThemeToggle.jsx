import React from "react";

const CompanyPortalThemeToggle = ({ theme = "dark", setTheme }) => {
  const toggleTheme = () => {
    if (setTheme) setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <button
      type="button"
      className="company-portal-theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "تفعيل الوضع الصباحي" : "تفعيل الوضع المسائي"}
      title={theme === "dark" ? "تفعيل الوضع الصباحي" : "تفعيل الوضع المسائي"}
    >
      <span aria-hidden="true">☼</span>
      <span aria-hidden="true">◐</span>
      <i aria-hidden="true" className={theme === "dark" ? "is-dark" : ""} />
    </button>
  );
};

export default CompanyPortalThemeToggle;
