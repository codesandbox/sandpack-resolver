export function simplifySlashes(specifier: string): string {
  return specifier.replace(/[\\/]+/g, '/');
}

export function dirname(specifier: string): string {
  const parts = specifier.split('/');
  const popped = parts.pop();
  // Trailing /, pop again
  if (!popped) {
    parts.pop();
  }
  return parts.join('/') || '/';
}

export function join(...paths: string[]): string {
  let result: string[] = [];
  for (const path of paths) {
    const parts = path.split('/');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '..') {
        if (result.length) {
          result.pop();
        } else {
          result.push(part);
        }
      } else if (part !== '.') {
        result.push(part);
      }
    }
  }
  return simplifySlashes(result.join('/')) || '/';
}
