export interface VcsProvider {
  fetchFile(path: string, ref: string): Promise<string>;
}
