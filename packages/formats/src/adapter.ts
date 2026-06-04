export interface FormatAdapter {
  readonly name: string;
  readonly extensions: readonly string[];
  parse(content: string): Record<string, string>;
  serialize(translations: Record<string, string>): string;
}
