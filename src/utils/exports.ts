import { normalizeAliasFilePath } from './alias';

type PackageExportType = string | null | false | PackageExportObj | PackageExportArr;

type PackageExportArr = Array<PackageExportObj | string>;

type PackageExportObj = {
  [key: string]: string | null | false | PackageExportType;
};

export function normalizePackageExport(filepath: string, pkgRoot: string): string {
  return normalizeAliasFilePath(filepath.replace(/\*/g, '$1'), pkgRoot);
}

export function extractPathFromExport(
  exportValue: PackageExportType,
  pkgRoot: string,
  exportKeys: string[],
  isExport: boolean,
): string | false {
  if (!exportValue) {
    return false;
  }

  if (typeof exportValue === 'string') {
    return normalizePackageExport(exportValue, pkgRoot);
  }

  if (Array.isArray(exportValue)) {
    const foundPaths = exportValue.map((v) => extractPathFromExport(v, pkgRoot, exportKeys, isExport)).filter(Boolean);
    if (!foundPaths.length) {
      return false;
    }
    return foundPaths[0];
  }

  if (typeof exportValue === 'object') {
    for (const key of exportKeys) {
      const exportFilename = exportValue[key];
      if (exportFilename !== undefined) {
        if (typeof exportFilename === 'string') {
          return normalizePackageExport(exportFilename, pkgRoot);
        }
        return extractPathFromExport(exportFilename, pkgRoot, exportKeys, isExport);
      }
    }
    return false;
  }

  throw new Error(`Unsupported ${isExport ? 'exports' : 'imports'} type ${typeof exportValue}`);
}
