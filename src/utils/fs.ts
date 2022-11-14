export type FnIsFile = (filepath: string) => boolean | Promise<boolean>;
export type FnIsFileSync = (filepath: string) => boolean;
export type FnReadFile = (filepath: string) => Promise<string>;
export type FnReadFileSync = (filepath: string) => string;

export function getParentDirectories(filepath: string, rootDir: string = '/'): string[] {
  const parts = filepath.split('/');
  const directories = [];
  while (parts.length > 0) {
    const directory = parts.join('/') || '/';
    // Test /foo vs /foo-something - /foo-something is not in rootDir
    if (directory.length < rootDir.length || !directory.startsWith(rootDir)) {
      break;
    }
    directories.push(directory);
    parts.pop();
  }
  return directories;
}
