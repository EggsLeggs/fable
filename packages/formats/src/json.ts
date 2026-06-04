import type { FormatAdapter } from "./adapter";

function flatten(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      result[full] = value;
    } else if (value !== null && typeof value === "object") {
      Object.assign(result, flatten(value as Record<string, unknown>, full));
    }
  }
  return result;
}

function unflatten(flat: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let cursor: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (typeof cursor[part] !== "object") cursor[part] = {};
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]!] = value;
  }
  return result;
}

export const jsonFlat: FormatAdapter = {
  name: "JSON (flat)",
  extensions: [".json"],
  parse(content) {
    return JSON.parse(content) as Record<string, string>;
  },
  serialize(translations) {
    return JSON.stringify(translations, null, 2) + "\n";
  },
};

export const jsonNested: FormatAdapter = {
  name: "JSON (nested)",
  extensions: [".json"],
  parse(content) {
    return flatten(JSON.parse(content) as Record<string, unknown>);
  },
  serialize(translations) {
    return JSON.stringify(unflatten(translations), null, 2) + "\n";
  },
};
