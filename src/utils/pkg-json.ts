import { normalizeAliasFilePath } from './alias';
import { extractPathFromExport } from './exports';
import { EMPTY_SHIM } from './constants';
import { extractSpecifierFromImport } from './imports';

type AliasesDict = { [key: string]: string };

export interface ProcessedPackageJSON {
  aliases: AliasesDict;
  imports: AliasesDict;
}

function sortDescending(a: string, b: string) {
  return b.length - a.length;
}

export function processPackageJSON(
  content: any,
  pkgRoot: string,
  mainFields: string[],
  aliasFields: string[],
  environmentKeys: string[]
): ProcessedPackageJSON {
  if (!content || typeof content !== 'object') {
    return { aliases: {}, imports: {} };
  }

  const aliases: AliasesDict = {};
  for (const mainField of mainFields) {
    if (typeof content[mainField] === 'string') {
      aliases[pkgRoot] = normalizeAliasFilePath(content[mainField], pkgRoot);
      break;
    }
  }

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

  // load exports if it's not the root pkg.json
  if (content.exports && pkgRoot !== '/') {
    if (typeof content.exports === 'string') {
      aliases[pkgRoot] = normalizeAliasFilePath(content.exports, pkgRoot);
    } else if (typeof content.exports === 'object') {
      for (const exportKey of Object.keys(content.exports).sort(sortDescending)) {
        const exportValue = extractPathFromExport(content.exports[exportKey], pkgRoot, environmentKeys);
        const normalizedKey = normalizeAliasFilePath(exportKey, pkgRoot);
        aliases[normalizedKey] = exportValue || EMPTY_SHIM;
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

  return { aliases, imports };
}
