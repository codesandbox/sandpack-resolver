/* eslint-disable no-else-return */
/* eslint-disable no-continue */
import * as pathUtils from './utils/path';
import { ModuleNotFoundError } from './errors/ModuleNotFound';
import { EMPTY_SHIM } from './utils/constants';
import { replaceGlob } from './utils/glob';

import { ProcessedPackageJSON, processPackageJSON } from './utils/pkg-json';
import { FnIsFile, FnIsFileSync, FnReadFile, FnReadFileSync, getParentDirectories } from './utils/fs';
import { ProcessedTSConfig, processTSConfig, getPotentialPathsFromTSConfig } from './utils/tsconfig';

export type ResolverCache = Map<string, any>;

export interface IResolveOptionsInput {
  filename: string;
  extensions: string[];
  isFile: FnIsFile;
  isFileSync: FnIsFileSync;
  readFile: FnReadFile;
  readFileSync: FnReadFileSync;
  moduleDirectories?: string[];
  resolverCache?: ResolverCache;
  skipTsConfig?: boolean;

  /**
   * Fields to resolve, main is `module`, `main`, ...
   * sorted from high to low priority
   */
  mainFields: string[];
  /**
   * alias fields are parcel's alias field, browser field, ...
   * sorted from high to low priority
   * */
  aliasFields: string[];
  /**
   * Environment keys from high to low priority
   * Used for exports and imports field in pkg.json
   */
  environmentKeys: string[];
}

interface IResolveOptions extends IResolveOptionsInput {
  skipTsConfig: boolean;
  moduleDirectories: string[];
  resolverCache: ResolverCache;
}

function normalizeResolverOptions(opts: IResolveOptionsInput): IResolveOptions {
  const normalizedModuleDirectories: Set<string> = opts.moduleDirectories
    ? new Set(opts.moduleDirectories.map((p) => (p[0] === '/' ? p.substring(1) : p)))
    : new Set();
  normalizedModuleDirectories.add('node_modules');

  return {
    filename: opts.filename,
    extensions: [...new Set(['', ...opts.extensions])],
    isFile: opts.isFile,
    isFileSync: opts.isFileSync,
    readFile: opts.readFile,
    readFileSync: opts.readFileSync,
    moduleDirectories: [...normalizedModuleDirectories],
    resolverCache: opts.resolverCache || new Map(),
    mainFields: opts.mainFields,
    aliasFields: opts.aliasFields,
    environmentKeys: opts.environmentKeys,
    skipTsConfig: !!opts.skipTsConfig,
  };
}

interface IFoundPackageJSON {
  filepath: string;
  content: ProcessedPackageJSON;
}

function resolveFile(filepath: string, dir: string): string {
  switch (filepath[0]) {
    case '.':
      return pathUtils.join(dir, filepath);
    case '/':
      return filepath;
    default:
      // is a node module
      return filepath;
  }
}

function resolvePkgImport(specifier: string, pkgJson: IFoundPackageJSON): string {
  const pkgImports = pkgJson.content.imports;
  if (!pkgImports) return specifier;

  if (pkgImports[specifier]) {
    return pkgImports[specifier];
  }

  for (const [importKey, importValue] of Object.entries(pkgImports)) {
    if (!importKey.includes('*')) {
      continue;
    }

    const match = replaceGlob(importKey, importValue, specifier);
    if (match) {
      return match;
    }
  }

  return specifier;
}

// This might be interesting for improving exports support: https://github.com/lukeed/resolve.exports
export function resolveAlias(pkgJson: IFoundPackageJSON, filename: string): string {
  const aliases = pkgJson.content.aliases;

  let relativeFilepath = filename;
  let aliasedPath = relativeFilepath;
  let count = 0;
  do {
    relativeFilepath = aliasedPath;

    // Simply check to ensure we don't infinitely alias files due to a misconfiguration of a package/user
    if (count > 5) {
      throw new Error('Could not resolve file due to a cyclic alias');
    }
    count++;

    // Check for direct matches
    if (aliases[relativeFilepath]) {
      aliasedPath = aliases[relativeFilepath];
      continue;
    }

    for (const [aliasKey, aliasValue] of Object.entries(aliases)) {
      if (!aliasKey.includes('*')) {
        continue;
      }
      const match = replaceGlob(aliasKey, aliasValue, relativeFilepath);
      if (match) {
        aliasedPath = match;
        if (aliasedPath.startsWith(relativeFilepath)) {
          const newAddition = aliasedPath.substr(relativeFilepath.length);
          if (!newAddition.includes('/') && relativeFilepath.endsWith(newAddition)) {
            aliasedPath = relativeFilepath;
          }
        }
        break;
      }
    }

    // No new aliased path
    break;
  } while (relativeFilepath !== aliasedPath);

  return aliasedPath || relativeFilepath;
}

const extractPkgSpecifierParts = (specifier: string): { pkgName: string; filepath: string } => {
  const parts = specifier.split('/');
  const pkgName = parts[0][0] === '@' ? parts.splice(0, 2).join('/') : parts.shift();
  return {
    pkgName: pkgName!,
    filepath: parts.join('/'),
  };
};

export function normalizeModuleSpecifier(specifier: string): string {
  const normalized = pathUtils.simplifySlashes(specifier);
  if (normalized.endsWith('/')) {
    return normalized.substring(0, normalized.length - 1);
  }
  return normalized;
}

const TS_CONFIG_CACHE_KEY = '__root_tsconfig';
class Resolver {
  // $MakeMeSync
  async isFile(filepath: string, opts: IResolveOptions): Promise<boolean> {
    if (filepath === EMPTY_SHIM) {
      return true;
    }
    return opts.isFile(filepath); // $MakeMeSync
  }

  // $MakeMeSync
  async resolveModule(moduleSpecifier: string, opts: IResolveOptions): Promise<string> {
    const dirPath = pathUtils.dirname(opts.filename);
    const filename = resolveFile(moduleSpecifier, dirPath);
    const isAbsoluteFilename = filename[0] === '/';
    const pkgJson = await this.findPackageJSON(isAbsoluteFilename ? filename : opts.filename, opts);
    return resolveAlias(pkgJson, filename);
  }

  // $MakeMeSync
  async findPackageJSON(filepath: string, opts: IResolveOptions): Promise<IFoundPackageJSON> {
    let pkg = await this.loadPackageJSON(filepath, opts);
    if (!pkg) {
      pkg = await this.loadPackageJSON('/index', opts);
      if (!pkg) {
        return {
          filepath: '/package.json',
          content: {
            aliases: {},
            imports: {},
          },
        };
      }
    }
    return pkg;
  }

  // $MakeMeSync
  async expandFile(filepath: string, opts: IResolveOptions, expandCount: number = 0): Promise<string | null> {
    const pkg = await this.findPackageJSON(filepath, opts);

    if (expandCount > 5) {
      throw new Error('Cyclic alias detected');
    }

    for (const ext of opts.extensions) {
      const f = filepath + ext;
      const aliasedPath = resolveAlias(pkg, f);
      if (aliasedPath === f) {
        const exists = await this.isFile(f, opts);
        if (exists) {
          return f;
        }
      } else {
        const expanded = await this.expandFile(aliasedPath, { ...opts, extensions: [''] }, expandCount + 1);
        if (expanded) {
          return expanded;
        }
      }
    }
    return null;
  }

  // $MakeMeSync
  async getTSConfig(opts: IResolveOptions): Promise<ProcessedTSConfig | false> {
    const cachedConfig = opts.resolverCache.get(TS_CONFIG_CACHE_KEY);
    if (cachedConfig != null) {
      return cachedConfig;
    }

    let config: ProcessedTSConfig | false = false;
    try {
      const contents = await opts.readFile('/tsconfig.json');
      const processed = processTSConfig(contents);
      if (processed) {
        config = processed;
      }
    } catch (err) {
      try {
        const contents = await opts.readFile('/jsconfig.json');
        const processed = processTSConfig(contents);
        if (processed) {
          config = processed;
        }
      } catch {
        // do nothing
      }
    }
    opts.resolverCache.set(TS_CONFIG_CACHE_KEY, config);
    return config;
  }

  // $MakeMeSync
  async loadPackageJSON(
    filepath: string,
    opts: IResolveOptions,
    rootDir: string = '/'
  ): Promise<IFoundPackageJSON | null> {
    const directories = getParentDirectories(filepath, rootDir);
    for (const directory of directories) {
      const packageFilePath = pathUtils.join(directory, 'package.json');
      let packageContent = opts.resolverCache.get(packageFilePath);
      if (packageContent === undefined) {
        try {
          const content = await opts.readFile(packageFilePath);
          packageContent = processPackageJSON(
            JSON.parse(content),
            pathUtils.dirname(packageFilePath),
            opts.mainFields,
            opts.aliasFields,
            opts.environmentKeys
          );
          opts.resolverCache.set(packageFilePath, packageContent);
        } catch (err) {
          opts.resolverCache.set(packageFilePath, false);
        }
      }
      if (packageContent) {
        return {
          filepath: packageFilePath,
          content: packageContent,
        };
      }
    }
    return null;
  }

  // $MakeMeSync
  async resolveNodeModule(moduleSpecifier: string, opts: IResolveOptions): Promise<string> {
    const pkgSpecifierParts = extractPkgSpecifierParts(moduleSpecifier);
    const directories = getParentDirectories(opts.filename);
    for (const modulesPath of opts.moduleDirectories) {
      for (const directory of directories) {
        const rootDir = pathUtils.join(directory, modulesPath, pkgSpecifierParts.pkgName);

        try {
          const pkgFilePath = pathUtils.join(rootDir, pkgSpecifierParts.filepath);
          const pkgJson = await this.loadPackageJSON(pkgFilePath, opts, rootDir);
          if (pkgJson) {
            try {
              return this.internalResolve(pkgFilePath, {
                ...opts,
                filename: pkgJson.filepath,
              }); // $MakeMeSync
            } catch (err) {
              if (!pkgSpecifierParts.filepath) {
                return this.internalResolve(pathUtils.join(pkgFilePath, 'index'), {
                  ...opts,
                  filename: pkgJson.filepath,
                }); // $MakeMeSync
              }

              throw err;
            }
          }
        } catch (err) {
          // Handle multiple duplicates of a node_module across the tree
          if (directory.length > 1) {
            return this.resolveNodeModule(moduleSpecifier, {
              ...opts,
              filename: pathUtils.dirname(directory),
            }); // $MakeMeSync
          }

          throw err;
        }
      }
    }
    throw new ModuleNotFoundError(moduleSpecifier, opts.filename);
  }

  // $MakeMeSync
  async internalResolve(
    moduleSpecifier: string,
    opts: IResolveOptions,
    skipIndexExpansion: boolean = false
  ): Promise<string> {
    const normalizedSpecifier = normalizeModuleSpecifier(moduleSpecifier);
    const modulePath = await this.resolveModule(normalizedSpecifier, opts);

    if (modulePath[0] !== '/') {
      // This isn't a node module, we can attempt to resolve using a tsconfig/jsconfig
      if (!opts.skipTsConfig && !opts.filename.includes('/node_modules')) {
        const parsedTSConfig = await this.getTSConfig(opts);
        if (parsedTSConfig) {
          const potentialPaths = getPotentialPathsFromTSConfig(modulePath, parsedTSConfig);
          for (const potentialPath of potentialPaths) {
            try {
              return this.internalResolve(potentialPath, opts); // $MakeMeSync
            } catch {
              // do nothing, it's probably a node_module in this case
            }
          }
        }
      }

      try {
        return this.resolveNodeModule(modulePath, opts); // $MakeMeSync
      } catch (e) {
        throw new ModuleNotFoundError(normalizedSpecifier, opts.filename);
      }
    }

    let foundFile = await this.expandFile(modulePath, opts);
    if (!foundFile && !skipIndexExpansion) {
      foundFile = await this.expandFile(pathUtils.join(modulePath, 'index'), opts);

      // In case alias adds an extension, we retry the entire resolution with an added /index
      // This is mostly a hack I guess, but it works for now, so many edge-cases
      if (!foundFile) {
        try {
          const parts = moduleSpecifier.split('/');
          if (!parts.length || !parts[parts.length - 1].startsWith('index')) {
            foundFile = await this.internalResolve(moduleSpecifier + '/index', opts, true);
          }
        } catch (err) {
          // should throw ModuleNotFound for original specifier, not new one
        }
      }
    }

    if (!foundFile) {
      throw new ModuleNotFoundError(modulePath, opts.filename);
    }

    return foundFile;
  }

  // $MakeMeSync
  async resolvePkgImports(specifier: string, opts: IResolveOptions): Promise<string> {
    // Imports always have the `#` prefix
    if (specifier[0] !== '#') {
      return specifier;
    }

    const pkgJson = await this.findPackageJSON(opts.filename, opts);
    const resolved = resolvePkgImport(specifier, pkgJson);
    if (resolved !== specifier) {
      opts.filename = pkgJson.filepath;
    }
    return resolved;
  }

  // $RemoveMe
  resolveSync(moduleSpecifier: string, inputOpts: IResolveOptionsInput): string {
    throw new Error('Not compiled');
  }

  // $MakeMeSync
  async resolve(moduleSpecifier: string, inputOpts: IResolveOptionsInput): Promise<string> {
    const opts = normalizeResolverOptions(inputOpts);
    const specifier = await this.resolvePkgImports(moduleSpecifier, opts);
    return this.internalResolve(specifier, opts); // $MakeMeSync
  }
}

export default new Resolver();
