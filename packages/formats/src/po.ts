import type { FormatAdapter } from "./adapter";

function parsePo(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    let msgid = "";
    let msgstr = "";
    let inMsgid = false;
    let inMsgstr = false;

    for (const line of lines) {
      if (line.startsWith("msgid ")) {
        inMsgid = true;
        inMsgstr = false;
        msgid = line.slice(7, -1);
      } else if (line.startsWith("msgstr ")) {
        inMsgid = false;
        inMsgstr = true;
        msgstr = line.slice(8, -1);
      } else if (line.startsWith('"')) {
        const value = line.slice(1, -1);
        if (inMsgid) msgid += value;
        else if (inMsgstr) msgstr += value;
      }
    }

    if (msgid) result[msgid] = msgstr;
  }

  return result;
}

function serializePo(translations: Record<string, string>): string {
  const lines: string[] = [
    'msgid ""',
    'msgstr ""',
    '"Content-Type: text/plain; charset=UTF-8\\n"',
    "",
  ];

  for (const [msgid, msgstr] of Object.entries(translations)) {
    lines.push(`msgid "${msgid}"`);
    lines.push(`msgstr "${msgstr}"`);
    lines.push("");
  }

  return lines.join("\n");
}

export const poAdapter: FormatAdapter = {
  name: "PO / Gettext",
  extensions: [".po"],
  parse: parsePo,
  serialize: serializePo,
};
