import yaml from "js-yaml";
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

export const yamlAdapter: FormatAdapter = {
  name: "YAML",
  extensions: [".yml", ".yaml"],
  defaultOutputPattern: "%original_path%/%locale%/%original_file_name%",
  parse(content) {
    return flatten(yaml.load(content) as Record<string, unknown>);
  },
  parseTranslation(content) {
    return flatten(yaml.load(content) as Record<string, unknown>);
  },
  serialize(translations) {
    return yaml.dump(translations, { indent: 2, lineWidth: 120 });
  },
};
