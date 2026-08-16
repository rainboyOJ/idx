"use strict";

const THEME_KEY = "rainboy-nav-theme";

const state = {
  observer: null,
};

const elements = {
  backToTop: document.querySelector("#back-to-top"),
  themeToggle: document.querySelector("#theme-toggle"),
};

function setActiveCategory(groupId) {
  document.querySelectorAll(".category-link").forEach((link) => {
    const active = link.dataset.groupId === String(groupId);
    if (active) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function observeSections() {
  state.observer?.disconnect();
  const sections = document.querySelectorAll(".directory-section");
  if (!sections.length) return;

  state.observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
      if (visible[0]) setActiveCategory(visible[0].target.dataset.groupId);
    },
    { rootMargin: "-104px 0px -68% 0px", threshold: 0 },
  );

  sections.forEach((section) => state.observer.observe(section));
  setActiveCategory(sections[0].dataset.groupId);
}

function setupImageFallbacks() {
  document.querySelectorAll(".category-icon, .section-icon, .link-icon").forEach((image) => {
    const revealFallback = () => {
      image.hidden = true;
      if (image.nextElementSibling) image.nextElementSibling.hidden = false;
    };

    image.addEventListener("error", revealFallback, { once: true });
    if (image.complete && image.naturalWidth === 0) revealFallback();
  });
}

function updateThemeButton() {
  const isDark = document.documentElement.dataset.theme === "dark";
  elements.themeToggle.setAttribute("aria-label", isDark ? "切换到浅色主题" : "切换到深色主题");
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch {
    // The selected theme still applies for this page load.
  }
  updateThemeButton();
}

elements.themeToggle.addEventListener("click", toggleTheme);
elements.backToTop.addEventListener("click", () => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
});

window.addEventListener(
  "scroll",
  () => {
    elements.backToTop.hidden = window.scrollY < 640;
  },
  { passive: true },
);

setupImageFallbacks();
observeSections();
updateThemeButton();
