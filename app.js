"use strict";

const THEME_KEY = "rainboy-nav-theme";
const DESKTOP = matchMedia("(min-width: 1024px)");
const MOTION = matchMedia("(prefers-reduced-motion: reduce)");

const state = { observer: null, announcedTotal: -1, hadFirstQuery: false, raf: 0 };

const $ = (id) => document.getElementById(id);
const elements = {
  backToTop: $("back-to-top"),
  themeToggle: $("theme-toggle"),
  searchInput: $("site-search"),
  searchClear: $("search-clear"),
  resultCount: $("result-count"),
  searchStatus: $("search-status"),
  categorySidebar: $("category-sidebar"),
  categoryList: $("category-list"),
  directory: $("directory"),
  emptyState: $("search-empty"),
  emptyQuery: $("empty-query"),
  emptyClear: $("empty-clear"),
};

const normalize = (value) => String(value || "").normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
const reducedMotion = () => MOTION.matches;

function buildFieldMap(original) {
  const pieces = [];
  const charMap = [];
  let pos = 0;
  for (const ch of original) {
    const expanded = ch.normalize("NFKC");
    charMap.push([pos, pos + expanded.length]);
    pieces.push(expanded);
    pos += expanded.length;
  }
  const lowered = pieces.join("").toLocaleLowerCase("zh-CN");
  const lead = lowered.length - lowered.trimStart().length;
  return { original, norm: lowered.slice(lead), lead, charMap };
}

function mapRange(start, end, charMap) {
  let first = -1;
  let last = -1;
  for (let i = 0; i < charMap.length; i += 1) {
    const [lo, hi] = charMap[i];
    if (lo <= start && start < hi) first = i;
    if (lo < end && end <= hi) last = i;
  }
  if (first === -1 || last === -1 || first > last) return null;
  return [first, last + 1];
}

function findRanges(field, terms) {
  const { original, norm, lead, charMap } = field;

  const ranges = [];
  for (const term of terms) {
    let from = 0;
    while (true) {
      const at = norm.indexOf(term, from);
      if (at === -1) break;
      const mapped = mapRange(at + lead, at + term.length + lead, charMap);
      if (mapped) {
        const [start, end] = mapped;
        if (normalize(original.slice(start, end)) === norm.slice(at, at + term.length)) {
          ranges.push([start, end]);
        }
      }
      from = at + term.length;
    }
  }
  ranges.sort((left, right) => left[0] - right[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}

function applyHighlights(el, original, ranges) {
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) fragment.appendChild(document.createTextNode(original.slice(cursor, start)));
    const mark = document.createElement("mark");
    mark.appendChild(document.createTextNode(original.slice(start, end)));
    fragment.appendChild(mark);
    cursor = end;
  }
  if (cursor < original.length) fragment.appendChild(document.createTextNode(original.slice(cursor)));
  el.replaceChildren(fragment);
}

function restoreField(element, original) {
  element.replaceChildren(document.createTextNode(original));
}

const items = Array.from(document.querySelectorAll(".link-card")).map((card) => {
  const titleEl = card.querySelector(".link-title");
  const descEl = card.querySelector(".link-description");
  const hostEl = card.querySelector(".link-host");
  const section = card.closest(".directory-section");
  const title = titleEl.textContent;
  const hostText = hostEl ? hostEl.textContent : descEl.textContent;
  const titleMap = buildFieldMap(title);
  const hostMap = buildFieldMap(hostText);
  const descMap = hostEl ? buildFieldMap(descEl.textContent) : hostMap;
  const category = section.querySelector(".section-title").textContent;
  return {
    card,
    section,
    index: [titleMap.norm, descMap.norm, hostMap.norm, normalize(category)]
      .filter(Boolean)
      .join(" "),
    fields: [
      { el: titleEl, map: titleMap },
      { el: descEl, map: descMap },
      ...(hostEl ? [{ el: hostEl, map: hostMap }] : []),
    ],
  };
});

const sections = Array.from(document.querySelectorAll(".directory-section"));
const categoryLinks = Array.from(document.querySelectorAll(".category-link"));

function highlightItem(item, terms) {
  for (const field of item.fields) {
    const ranges = findRanges(field.map, terms);
    if (ranges.length) applyHighlights(field.el, field.map.original, ranges);
    else restoreField(field.el, field.map.original);
  }
}

function stickyHeight() {
  const workbarHeight = document.querySelector(".workbar").getBoundingClientRect().height;
  if (DESKTOP.matches) return Math.round(workbarHeight);
  return Math.round(workbarHeight + elements.categorySidebar.getBoundingClientRect().height);
}

function setActiveCategory(groupId) {
  for (const link of categoryLinks) {
    if (link.dataset.groupId === String(groupId)) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
  scrollActiveIntoView();
}

function scrollActiveIntoView() {
  if (DESKTOP.matches) return;
  const active = elements.categoryList.querySelector('.category-link[aria-current="true"]');
  if (!active) return;
  const list = elements.categoryList;
  const listRect = list.getBoundingClientRect();
  const target =
    active.getBoundingClientRect().left - listRect.left - (list.clientWidth - active.offsetWidth) / 2;
  const max = list.scrollWidth - list.clientWidth;
  list.scrollTo({
    left: target < 0 ? 0 : target > max ? max : target,
    behavior: reducedMotion() ? "auto" : "smooth",
  });
}

function updateRailOverflow() {
  if (DESKTOP.matches) {
    elements.categorySidebar.dataset.overflow = "none";
    return;
  }
  const list = elements.categoryList;
  const canScroll = list.scrollWidth > list.clientWidth + 1;
  const atStart = list.scrollLeft <= 1;
  const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1;
  const value = canScroll && (!atStart || !atEnd) ? (atStart ? "end" : atEnd ? "start" : "both") : "none";
  elements.categorySidebar.dataset.overflow = value;
}

function observeSections() {
  state.observer?.disconnect();
  const visible = sections.filter((section) => !section.hidden);
  if (!visible.length) {
    categoryLinks.forEach((link) => link.removeAttribute("aria-current"));
    return;
  }
  state.observer = new IntersectionObserver(
    (entries) => {
      const top = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      if (top) setActiveCategory(top.target.dataset.groupId);
    },
    { rootMargin: `-${stickyHeight()}px 0px -68% 0px`, threshold: 0 },
  );
  visible.forEach((section) => state.observer.observe(section));
  setActiveCategory(visible[0].dataset.groupId);
}

function scheduleObserverRebuild() {
  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(() => {
    observeSections();
    updateRailOverflow();
  });
}

function applyFilter() {
  const raw = elements.searchInput.value;
  const terms = normalize(raw).split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const totalItems = items.length;

  if (searching && !state.first) {
    state.first = true;
    const top = elements.directory.getBoundingClientRect().top + window.scrollY - stickyHeight();
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? "auto" : "smooth" });
  } else if (!searching) {
    state.first = false;
  }

  const groupCounts = new Map();
  let total = 0;

  for (const item of items) {
    const match = !searching || terms.every((term) => item.index.includes(term));
    item.card.hidden = !match;
    if (!searching) {
      item.fields.forEach((field) => restoreField(field.el, field.map.original));
    } else if (match) {
      total += 1;
      const gid = item.section.dataset.groupId;
      groupCounts.set(gid, (groupCounts.get(gid) || 0) + 1);
      highlightItem(item, terms);
    }
  }

  for (const section of sections) {
    const count = groupCounts.get(section.dataset.groupId) || 0;
    section.hidden = searching && count === 0;
    const sectionCount = section.querySelector(".section-count");
    sectionCount.textContent = searching ? String(count) : sectionCount.dataset.total;
  }

  for (const link of categoryLinks) {
    const count = groupCounts.get(link.dataset.groupId) || 0;
    link.hidden = searching && count === 0;
    const countEl = link.querySelector(".category-count");
    countEl.textContent = searching ? String(count) : countEl.dataset.total;
  }

  elements.resultCount.textContent = searching ? `${total} / ${totalItems}` : `${totalItems} 个网址`;
  elements.searchClear.hidden = !searching;
  elements.categorySidebar.hidden = searching && total === 0;
  elements.emptyState.hidden = !(searching && total === 0);
  elements.emptyQuery.textContent = searching && total === 0 ? raw : "";

  if (!searching) {
    state.announced = -1;
  } else if (total !== state.announced) {
    state.announced = total;
    elements.searchStatus.textContent = `找到 ${total} 个网址，共 ${totalItems} 个`;
  }

  scheduleObserverRebuild();
}

function clearSearch() {
  elements.searchInput.value = "";
  applyFilter();
  elements.searchInput.focus();
}

function setupImageFallbacks() {
  document.querySelectorAll(".link-icon").forEach((image) => {
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
    }
  updateThemeButton();
}

function focusSearch() {
  elements.searchInput.focus();
  elements.searchInput.select();
}

elements.themeToggle.addEventListener("click", toggleTheme);
elements.searchInput.addEventListener("input", (event) => {
  if (event.isComposing) return;
  applyFilter();
});
elements.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (normalize(elements.searchInput.value)) {
      elements.searchInput.value = "";
      applyFilter();
    } else elements.searchInput.blur();
  } else if (event.key === "ArrowDown") {
    const first = document.querySelector(".link-card:not([hidden])");
    if (first) {
      event.preventDefault();
      first.focus();
    }
  }
});
elements.searchClear.addEventListener("click", clearSearch);
elements.emptyClear.addEventListener("click", clearSearch);
elements.categoryList.addEventListener("click", (event) => {
  const link = event.target.closest(".category-link");
  if (link) setActiveCategory(link.dataset.groupId);
});
elements.categoryList.addEventListener("scroll", updateRailOverflow, { passive: true });
elements.backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const editable =
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  if (editable) return;
  if (event.key === "/") {
    event.preventDefault();
    focusSearch();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    focusSearch();
  }
});

window.addEventListener(
  "scroll",
  () => {
    elements.backToTop.hidden = window.scrollY < 640;
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom) {
      const visible = sections.filter((section) => !section.hidden);
      if (visible.length) setActiveCategory(visible[visible.length - 1].dataset.groupId);
    }
  },
  { passive: true },
);

window.addEventListener("resize", () => {
  observeSections();
  updateRailOverflow();
});

setupImageFallbacks();
observeSections();
updateRailOverflow();
updateThemeButton();
