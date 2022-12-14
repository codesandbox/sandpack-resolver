import { normalizeAliasFilePath } from './alias';

type PackageExportType = string | null | false | PackageExportObj | PackageExportArr;

type PackageExportArr = Array<PackageExportObj | string>;

type PackageExportObj = {
  [key: string]: string | null | false | PackageExportType;
};

export function extractPathFromExport(
  exportValue: PackageExportType,
  pkgRoot: string,
  environmentKeys: string[]
): string | false {
  if (!exportValue) {
    return false;
  }

  if (typeof exportValue === 'string') {
    return normalizeAliasFilePath(exportValue, pkgRoot);
  }

  if (Array.isArray(exportValue)) {
    const foundPaths = exportValue.map((v) => extractPathFromExport(v, pkgRoot, environmentKeys)).filter(Boolean);
    if (!foundPaths.length) {
      return false;
    }
    return foundPaths[0];
  }

  if (typeof exportValue === 'object') {
    for (const key of environmentKeys) {
      const exportFilename = exportValue[key];
      if (exportFilename !== undefined) {
        if (typeof exportFilename === 'string') {
          return normalizeAliasFilePath(exportFilename, pkgRoot);
        }
        return extractPathFromExport(exportFilename, pkgRoot, environmentKeys);
      }
    }
    return false;
  }

  throw new Error(`Unsupported exports type ${typeof exportValue}`);
}
