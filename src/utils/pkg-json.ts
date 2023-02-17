import { normalizeAliasFilePath } from './alias';
import { extractPathFromExport } from './exports';
import { EMPTY_SHIM } from './constants';
import { extractSpecifierFromImport } from './imports';

type AliasesDict = { [key: string]: string };

export interface ProcessedPackageJSON {
  aliases: AliasesDict;
  imports: AliasesDict;
  hasExports: boolean;
}

function sortDescending(a: string, b: string) {
  return b.length - a.length;
}

// See https://webpack.js.org/guides/package-exports/ for a good reference on how this should work
// We aren't completely spec compliant but we're trying to match it as close as possible without nuking performance
export function processPackageJSON(
  content: any,
  pkgRoot: string,
  mainFields: string[],
  aliasFields: string[],
  environmentKeys: string[]
): ProcessedPackageJSON {
  if (!content || typeof content !== 'object') {
    return { aliases: {}, imports: {}, hasExports: false };
  }

  const hasExports = content.exports && pkgRoot !== '/';

  const aliases: AliasesDict = {};

  // If there are exports the entry point should be configured in those exports
  // so we ignore the other main fields
  if (!hasExports) {
    for (const mainField of mainFields) {
      if (typeof content[mainField] === 'string') {
        aliases[pkgRoot] = normalizeAliasFilePath(content[mainField], pkgRoot);
        break;
      }
    }
  }

  // load exports from any package.json except for the root /package.json
  if (hasExports) {
    if (typeof content.exports === 'string') {
      aliases[pkgRoot] = normalizeAliasFilePath(content.exports, pkgRoot);
    } else if (typeof content.exports === 'object') {
      const exportKeys = Object.keys(content.exports);
      if (!exportKeys[0].startsWith('.')) {
        const resolvedExport = extractPathFromExport(content.exports, pkgRoot, environmentKeys);
        if (!resolvedExport) {
          throw new Error(`Could not find a valid export for ${pkgRoot}`);
        }
        aliases[pkgRoot] = resolvedExport;
      } else {
        for (const exportKey of Object.keys(content.exports).sort(sortDescending)) {
          const exportValue = extractPathFromExport(content.exports[exportKey], pkgRoot, environmentKeys);
          const normalizedKey = normalizeAliasFilePath(exportKey, pkgRoot);
          aliases[normalizedKey] = exportValue || EMPTY_SHIM;
        }
      }
    }
  }

  // These aliases should happen as a seperate pass from exports
  // but let's just give it a higher priority for now, we can refactor it later
  if (content.browser === false && mainFields.includes('browser')) {
    aliases[pkgRoot] = EMPTY_SHIM;
  }

  for (const aliasFieldKey of aliasFields) {
    const aliasField = content[aliasFieldKey];
    if (typeof aliasField === 'object') {
      for (const key of Object.keys(aliasField).sort(sortDescending)) {
        const val = aliasField[key] || EMPTY_SHIM;
        const normalizedKey = normalizeAliasFilePath(key, pkgRoot, false);
        const normalizedValue = normalizeAliasFilePath(val, pkgRoot, false);
        aliases[normalizedKey] = normalizedValue.replace(/\$1/g, '*');

        if (aliasFieldKey !== 'browser') {
          aliases[`${normalizedKey}/*`] = `${normalizedValue}/*`;
        }
      }
    }
  }

  // load imports
  const imports: AliasesDict = {};
  if (content.imports) {
    if (typeof content.imports === 'object') {
      for (const importKey of Object.keys(content.imports).sort(sortDescending)) {
        const value = extractSpecifierFromImport(content.imports[importKey], pkgRoot, environmentKeys);
        imports[importKey] = value || EMPTY_SHIM;
      }
    }
  }

  return { aliases, imports, hasExports };
}
