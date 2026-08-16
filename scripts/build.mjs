#!/usr/bin/env bun

import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pug from "pug";
import { parse } from "yaml";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const configPath = resolve(projectRoot, "config.yaml");
const templatePath = resolve(projectRoot, "index.pug");
const outputPath = resolve(projectRoot, "index.html");
const lucideIconsPath = resolve(projectRoot, "node_modules/@iconify-json/lucide/icons.json");

const LUCIDE_ICON_WHITELIST = [
  "globe",
  "list-checks",
  "users",
  "square-code",
  "book-open",
  "notebook-pen",
  "wrench",
  "archive",
  "bot",
  "package-open",
  "network",
  "search",
  "x",
  "sun",
  "moon",
  "arrow-up",
  "external-link",
];

const CATEGORY_ICON_MAP = {
  网站: "globe",
  题单: "list-checks",
  团队: "users",
  OJ: "square-code",
  知识: "book-open",
  Blog: "notebook-pen",
  工具: "wrench",
  资料: "archive",
  AIa: "bot",
  资源: "package-open",
  关联: "network",
};

const errors = [];
const warnings = [];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, path) {
  if (!isRecord(value)) {
    errors.push(`${path} 必须是对象`);
    return {};
  }
  return value;
}

function requireText(value, path) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${path} 必须是非空字符串`);
    return "";
  }
  return value;
}

function optionalText(value, path) {
  if (value === undefined) return;
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${path} 必须是非空字符串`);
  }
}

function requireList(value, path) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} 必须是非空数组`);
    return [];
  }
  return value;
}

async function validateLocalAsset(value, path) {
  if (value === undefined) return;
  optionalText(value, path);
  if (typeof value !== "string" || !value.trim()) return;

  const assetPath = resolve(projectRoot, value);
  const projectRelativePath = relative(projectRoot, assetPath);
  if (projectRelativePath.startsWith("..") || projectRelativePath === "") {
    errors.push(`${path} 必须指向项目内的文件`);
    return;
  }

  try {
    if (!(await stat(assetPath)).isFile()) {
      errors.push(`${path} 引用的文件不存在: ${value}`);
    }
  } catch {
    errors.push(`${path} 引用的文件不存在: ${value}`);
  }
}

function validateUrl(value, path) {
  const text = requireText(value, path);
  if (!text) return;

  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push(`${path} 仅支持 HTTP(S) URL`);
      return;
    }

    const sensitiveKey = [...url.searchParams.keys()].find((key) =>
      /^(password|passwd|token|secret|api_?key|auth)$/i.test(key),
    );
    if (sensitiveKey) {
      warnings.push(`${path} 的查询参数可能包含凭据: ${sensitiveKey}`);
    }
  } catch {
    errors.push(`${path} 不是有效 URL`);
  }
}

async function validateConfig(config) {
  const root = requireRecord(config, "config");
  const site = requireRecord(root.site, "site");
  requireText(site.title, "site.title");
  requireText(site.description, "site.description");
  requireText(site.metaDescription, "site.metaDescription");

  const navigation = requireRecord(root.navigation, "navigation");
  const updatedAt = requireText(navigation.updatedAt, "navigation.updatedAt");
  if (updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(updatedAt)) {
    errors.push("navigation.updatedAt 必须使用 YYYY-MM-DD 格式");
  }

  const groups = requireList(navigation.groups, "navigation.groups");
  const groupIds = new Set();

  for (const [groupIndex, rawGroup] of groups.entries()) {
    const groupPath = `navigation.groups[${groupIndex}]`;
    const group = requireRecord(rawGroup, groupPath);
    const id = requireText(group.id, `${groupPath}.id`);
    if (id && !/^[a-zA-Z0-9_-]+$/.test(id)) {
      errors.push(`${groupPath}.id 只能包含字母、数字、下划线和连字符`);
    }
    if (id && groupIds.has(id)) {
      errors.push(`${groupPath}.id 与其他分类重复: ${id}`);
    }
    groupIds.add(id);

    requireText(group.title, `${groupPath}.title`);
    await validateLocalAsset(group.icon, `${groupPath}.icon`);

    const items = requireList(group.items, `${groupPath}.items`);
    for (const [itemIndex, rawItem] of items.entries()) {
      const itemPath = `${groupPath}.items[${itemIndex}]`;
      const item = requireRecord(rawItem, itemPath);
      requireText(item.title, `${itemPath}.title`);
      validateUrl(item.url, `${itemPath}.url`);
      optionalText(item.description, `${itemPath}.description`);
      optionalText(item.iconText, `${itemPath}.iconText`);
      await validateLocalAsset(item.icon, `${itemPath}.icon`);

      if (
        item.iconBackground !== undefined &&
        (typeof item.iconBackground !== "string" ||
          !/^#[0-9a-f]{3,8}$/i.test(item.iconBackground))
      ) {
        errors.push(`${itemPath}.iconBackground 必须是十六进制颜色`);
      }
    }
  }

  return { site, navigation, groups };
}

async function loadConfig() {
  const source = await readFile(configPath, "utf8");
  try {
    return parse(source);
  } catch (error) {
    throw new Error(`config.yaml 解析失败: ${error.message}`);
  }
}

async function writeAtomically(content) {
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function loadLucideIcons() {
  let iconsData;
  try {
    iconsData = JSON.parse(await readFile(lucideIconsPath, "utf8"));
  } catch (error) {
    errors.push(`无法读取 Lucide 图标数据: ${error.message}`);
    return { icons: {}, refs: {}, sprite: "" };
  }

  const icons = {};
  const symbols = [];
  for (const name of LUCIDE_ICON_WHITELIST) {
    const icon = iconsData.icons?.[name];
    if (!icon || typeof icon.body !== "string") {
      errors.push(`Lucide 图标不存在: ${name}`);
      continue;
    }
    const width = icon.width || iconsData.width || 24;
    const height = icon.height || iconsData.height || 24;
    symbols.push(`<symbol id="lucide-${name}" viewBox="0 0 ${width} ${height}">${icon.body}</symbol>`);
    icons[name] = `<svg class="lucide lucide-${name}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><use href="#lucide-${name}"></use></svg>`;
  }
  const sprite = `<svg class="lucide-sprite" aria-hidden="true" focusable="false" hidden>${symbols.join("")}</svg>`;

  const categoryIcons = {};
  for (const [title, name] of Object.entries(CATEGORY_ICON_MAP)) {
    if (!icons[name]) {
      errors.push(`分类图标映射引用了白名单外的图标: ${title} -> ${name}`);
      continue;
    }
    categoryIcons[title] = name;
  }
  return { icons, categoryIcons, sprite };
}

async function main() {
  const config = await loadConfig();
  const { site, navigation, groups } = await validateConfig(config);
  const { icons: uiIcons, categoryIcons, sprite: uiIconSprite } = await loadLucideIcons();

  if (errors.length) {
    throw new Error(`配置校验失败:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  const stats = {
    totalGroups: groups.length,
    totalItems: groups.reduce((total, group) => total + group.items.length, 0),
  };
  const html = pug.renderFile(templatePath, {
    site,
    navigation,
    stats,
    uiIcons,
    categoryIcons,
    uiIconSprite,
    pretty: true,
  });

  await writeAtomically(`${html.trimEnd()}\n`);

  console.log(`生成完成: ${stats.totalGroups} 个分类, ${stats.totalItems} 个网址`);
  console.log(`输出文件: ${outputPath}`);
  if (warnings.length) {
    console.warn(`\n${warnings.length} 条提醒:`);
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
