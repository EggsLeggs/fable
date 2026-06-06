export interface FormatAdapter {
  readonly name: string;
  readonly extensions: readonly string[];
  readonly defaultOutputPattern?: string;
  parse(content: string): Record<string, string>;
  parseTranslation(content: string): Record<string, string>;
  serialize(
    translated: Record<string, string>,
    sourceStrings?: Record<string, string>
  ): string;
}
