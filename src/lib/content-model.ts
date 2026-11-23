// Shared shape of website content stored in Sanity: one "contentModule" document per
// former src/data file, holding flat entries (path + en/ta/si text) that rebuild the original object.
export const LANGS = ["en", "ta", "si"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABELS: Record<Lang, string> = { en: "English", ta: "Tamil", si: "Sinhala" };

export type EntryKind = "string" | "number" | "boolean" | "null" | "emptyArray" | "emptyObject";
export type ContentEntry = { _key: string; path: string; kind: EntryKind } & Partial<
  Record<Lang, string>
>;
export type ContentModule = {
  _id: string;
  key: string;
  title: string;
  group: string;
  sourceFile: string;
  localized: boolean;
  entries: ContentEntry[];
};

function tokens(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  for (const part of path.split(".")) {
    const m = part.match(/^([^[]*)((?:\[\d+\])*)$/);
    if (!m) {
      out.push(part);
      continue;
    }
    if (m[1]) out.push(m[1]);
    for (const i of (m[2] ?? "").matchAll(/\[(\d+)\]/g)) out.push(Number(i[1]));
  }
  return out;
}

function leaf(kind: EntryKind, raw: string | undefined): unknown {
  switch (kind) {
    case "number":
      return raw === undefined || raw === "" ? null : Number(raw);
    case "boolean":
      return raw === "true";
    case "null":
      return null;
    case "emptyArray":
      return [];
    case "emptyObject":
      return {};
    default:
      return raw ?? "";
  }
}

/** Rebuilds the original object for one language. Missing translations fall back to English. */
export function rebuild(entries: ContentEntry[], lang: Lang, fallback: Lang = "en"): unknown {
  let root: unknown;
  for (const e of entries) {
    const value = leaf(e.kind, e[lang] ?? e[fallback]);
    const t = tokens(e.path);
    if (t.length === 0) {
      root = value;
      continue;
    }
    if (root === undefined) root = typeof t[0] === "number" ? [] : {};
    let node = root as Record<string | number, unknown>;
    t.forEach((tok, i) => {
      if (i === t.length - 1) {
        node[tok] = value;
        return;
      }
      if (node[tok] === undefined) node[tok] = typeof t[i + 1] === "number" ? [] : {};
      node = node[tok] as Record<string | number, unknown>;
    });
  }
  return root;
}

/** Entries whose Tamil or Sinhala text is missing (only for translatable text). */
export function missingTranslations(m: Pick<ContentModule, "localized" | "entries">) {
  if (!m.localized) return [];
  return m.entries.filter((e) => e.kind === "string" && (e.en ?? "") !== "" && (!e.ta || !e.si));
}
