import fs from 'fs';
import path from 'path/posix';

import resolver, { normalizeModuleSpecifier, resolveAlias } from '../lib/resolver.js';
import { ModuleNotFoundError } from './errors/ModuleNotFound';

const FIXTURE_PATH = path.join(__dirname, 'fixture');

// alias/exports/main keys, sorted from high to low priority
const MAIN_KEYS = ['module', 'browser', 'main', 'jsnext:main'];
const ALIAS_KEYS = ['browser', 'alias'];
const ENV_KEYS = ['browser', 'development', 'default', 'require', 'import'];

const readFiles = (dir: string, rootPath: string, files: Map<string, string>) => {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const filepath = path.join(dir, entry);
    const entryStats = fs.statSync(filepath);
    if (entryStats.isDirectory()) {
      readFiles(filepath, rootPath, files);
    } else if (entryStats.isFile()) {
      files.set(filepath.replace(rootPath, ''), fs.readFileSync(filepath, 'utf8'));
    }
  }
  return files;
};

describe('resolve', () => {
  const files: Map<string, string> = readFiles(FIXTURE_PATH, FIXTURE_PATH, new Map());
  const isFileSync = (p: string) => {
    return files.has(p);
  };
  const isFile = async (p: string) => isFileSync(p);
  const readFileSync = (p: string) => {
    const file = files.get(p);
    if (!file) {
      throw new Error('File not found');
    }
    return file;
  };
  const readFile = async (p: string) => readFileSync(p);
  const baseConfig = {
    isFile,
    isFileSync,
    readFile,
    readFileSync,
    mainFields: MAIN_KEYS,
    aliasFields: ALIAS_KEYS,
    environmentKeys: ENV_KEYS,
  };

  describe('resolveAlias', () => {
    it('resolves to an exact alias', () => {
      const resolved = resolveAlias(
        {
          filepath: '/node_modules/@nuxt/ui-templates/package.json',
          content: {
            aliases: {
              '/node_modules/@nuxt/ui-templates': '/node_modules/@nuxt/ui-templates/dist/index.mjs',
              '/node_modules/@nuxt/ui-templates/templates/*': '/node_modules/@nuxt/ui-templates/dist/templates/*',
              '/node_modules/@nuxt/ui-templates/*': '/node_modules/@nuxt/ui-templates/dist/*',
            },
            imports: {},
          },
        },
        '/node_modules/@nuxt/ui-templates'
      );

      expect(resolved).toBe('/node_modules/@nuxt/ui-templates/dist/index.mjs');
    });

    it('resolves to dist alias', () => {
      const resolved = resolveAlias(
        {
          filepath: '/node_modules/@nuxt/ui-templates/package.json',
          content: {
            aliases: {
              '/node_modules/@nuxt/ui-templates': '/node_modules/@nuxt/ui-templates/dist/index.mjs',
              '/node_modules/@nuxt/ui-templates/templates/*': '/node_modules/@nuxt/ui-templates/dist/templates/*',
              '/node_modules/@nuxt/ui-templates/*': '/node_modules/@nuxt/ui-templates/dist/*',
            },
            imports: {},
          },
        },
        '/node_modules/@nuxt/ui-templates/dist/index'
      );

      expect(resolved).toBe('/node_modules/@nuxt/ui-templates/dist/index');
    });
  });

  describe('file paths', () => {
    it('should resolve relative file with an extension', () => {
      const resolved = resolver.resolveSync('../source/dist.js', {
        ...baseConfig,
        filename: '/packages/source-alias/other.js',
        extensions: ['.js'],
      });
      expect(resolved).toBe('/packages/source/dist.js');
    });

    it('should resolve relative file without an extension', () => {
      const resolved = resolver.resolveSync('./bar', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.js'],
      });
      expect(resolved).toBe('/bar.js');
    });

    it('should resolve an absolute path with extension', () => {
      const resolved = resolver.resolveSync('/bar.js', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.js'],
      });
      expect(resolved).toBe('/bar.js');
    });

    it('should resolve an absolute path without extension', () => {
      const resolved = resolver.resolveSync('/nested/test', {
        ...baseConfig,
        filename: '/nested/index.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/nested/test.js');
    });

    it('should fallback to index if file does not exist', () => {
      const resolved = resolver.resolveSync('/nested', {
        ...baseConfig,
        filename: '/nested/test.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/nested/index.js');
    });

    it('should throw a module not found error if not found', () => {
      expect(() => {
        resolver.resolveSync('/nestedeeeee', {
          ...baseConfig,
          filename: '/nested/test.js',
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        });
      }).toThrowError(new ModuleNotFoundError('/nestedeeeee', '/nested/test.js'));
    });
  });

  describe('node modules', () => {
    it('should be able to resolve a node_modules index.js', () => {
      const resolved = resolver.resolveSync('foo', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/foo/index.js');
    });

    it('should resolve a node_modules package.main', () => {
      const resolved = resolver.resolveSync('package-main', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-main/main.js');
    });

    it('should resolve a simple node_modules package.main', () => {
      const resolved = resolver.resolveSync('simple', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/simple/entrypoint.js');
    });

    it('should fallback to higher level node_module in case of duplicates', () => {
      const resolved = resolver.resolveSync('punycode/1.3.2', {
        ...baseConfig,
        filename: '/nested_node_modules/node_modules/url/url.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/nested_node_modules/node_modules/punycode/1.3.2/punycode.js');
    });

    it('should be able to handle packages with nested package.json files, this is kinda invalid but whatever', () => {
      const resolved = resolver.resolveSync('styled-components/macro', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/styled-components/dist/macro.js');
    });

    it('should resolve a node_modules package.module', () => {
      const resolved = resolver.resolveSync('package-module', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-module/module.js');
    });

    it('should resolve a node_modules package.browser main field', () => {
      const resolved = resolver.resolveSync('package-browser', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-browser/browser.js');
    });

    it('should handle main => browser field', () => {
      const resolved = resolver.resolveSync('solid-js', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/solid-js/dist/solid.cjs');
    });

    it('should fall back to index.js when it cannot find package.main', () => {
      const resolved = resolver.resolveSync('package-fallback', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-fallback/index.js');
    });

    it('should resolve a node_module package.main pointing to a directory', () => {
      const resolved = resolver.resolveSync('package-main-directory', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-main-directory/nested/index.js');
    });

    it('should resolve a file inside a node_modules folder', () => {
      const resolved = resolver.resolveSync('foo/nested/baz', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/foo/nested/baz.js');
    });

    it('should resolve a scoped module', () => {
      const resolved = resolver.resolveSync('@scope/pkg', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/@scope/pkg/index.js');
    });

    it('should resolve a file inside a scoped module', () => {
      const resolved = resolver.resolveSync('@scope/pkg/foo/bar', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/@scope/pkg/foo/bar.js');
    });

    it('should throw a module not found error if not found', () => {
      expect(() => {
        resolver.resolveSync('unknown-module/test.js', {
          ...baseConfig,
          filename: '/nested/test.js',
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        });
      }).toThrowError(new ModuleNotFoundError('unknown-module/test.js', '/nested/test.js'));
    });

    it('should handle instantsearch.js index palooza', () => {
      expect(() => {
        resolver.resolveSync('instantsearch.js/es/widgets', {
          ...baseConfig,
          filename: '/foo.js',
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        });
      }).toThrow(`Cannot find module 'instantsearch.js/es/widgets' from '/foo.js'`);
    });
  });

  describe('package#browser', () => {
    it('should alias the main file using the package.browser field', () => {
      const resolved = resolver.resolveSync('package-browser-alias', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-browser-alias/browser.js');
    });

    it('should alias a sub-file using the package.browser field', () => {
      const resolved = resolver.resolveSync('package-browser-alias/foo', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-browser-alias/bar.js');
    });

    it('should alias a relative file using the package.browser field', () => {
      const resolved = resolver.resolveSync('./foo', {
        ...baseConfig,
        filename: '/node_modules/package-browser-alias/browser.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-browser-alias/bar.js');
    });

    it('should alias a deep nested relative file using the package.browser field', () => {
      const resolved = resolver.resolveSync('./nested', {
        ...baseConfig,
        filename: '/node_modules/package-browser-alias/browser.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-browser-alias/subfolder1/subfolder2/subfile.js');
    });

    it('should resolve to an empty file when package.browser resolves to false', () => {
      const resolved = resolver.resolveSync('package-browser-exclude', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('//empty.js');
    });

    it('should only resolve package.browser: false if ', () => {
      const resolved = resolver.resolveSync('util/util.js', {
        ...baseConfig,
        filename: '/node_modules/readable-stream/index.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/util/util.js');

      const exactResolved = resolver.resolveSync('util', {
        ...baseConfig,
        filename: '/node_modules/readable-stream/index.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(exactResolved).toBe('//empty.js');
    });
  });

  describe('package#alias', () => {
    it('should alias a sub-file using the package.alias field', () => {
      const resolved = resolver.resolveSync('package-alias/foo', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-alias/bar.js');
    });

    it('should alias a relative file using the package.alias field', () => {
      const resolved = resolver.resolveSync('./foo', {
        ...baseConfig,
        filename: '/node_modules/package-alias/browser.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-alias/bar.js');
    });

    it('should alias a glob using the package.alias field', () => {
      const resolved = resolver.resolveSync('./lib/test', {
        ...baseConfig,
        filename: '/node_modules/package-alias-glob/index.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-alias-glob/src/test.js');
    });

    it('should apply a module alias using the package.alias field in the root package', () => {
      const resolved = resolver.resolveSync('aliased', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/foo/index.js');
    });

    it('should apply a module alias pointing to a file using the package.alias field', () => {
      const resolved = resolver.resolveSync('aliased-file', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/bar.js');
    });

    it('should resolve to an empty file when package.alias resolves to false', () => {
      const resolved = resolver.resolveSync('package-alias-exclude', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('//empty.js');
    });
  });

  describe('package#exports', () => {
    it('should alias package.exports root export', () => {
      const resolved = resolver.resolveSync('package-exports', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-exports/module.js');
    });

    it('should alias package.exports sub-module export', () => {
      const resolved = resolver.resolveSync('package-exports', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-exports/module.js');
    });

    it('should alias package.exports globs', () => {
      // Test path normalization as well
      const resolved = resolver.resolveSync('package-exports///components/a', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-exports/src/components/a.js');
    });

    it('should alias package.exports subdirectory globs', () => {
      const resolved = resolver.resolveSync('@zendesk/laika/esm/laika', {
        ...baseConfig,
        filename: '/index.tsx',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/@zendesk/laika/esm/laika.js');
    });

    it('should alias package.exports object globs', () => {
      const resolved = resolver.resolveSync('package-exports/utils/path/', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-exports/src/utils/path.js');
    });

    it('should resolve exports if it is a string', () => {
      const resolved = resolver.resolveSync('@scope/pkg-exports-main', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/@scope/pkg-exports-main/export.js');
    });

    it('should alias package.exports null/false to empty file', () => {
      const resolved = resolver.resolveSync('package-exports/internal', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('//empty.js');
    });

    it('should not load exports from the root package.json', () => {
      expect(() => {
        resolver.resolveSync('a-custom-export', {
          ...baseConfig,
          filename: '/foo.js',
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        });
      }).toThrow();
    });

    it('should not fail on wildcard *.js and folder references', () => {
      const resolved = resolver.resolveSync('./test', {
        ...baseConfig,
        filename: '/node_modules/package-exports/src/utils/path.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/node_modules/package-exports/src/utils/test/index.js');
    });

    it('rollup thingy', () => {
      const resolved = resolver.resolveSync('rollup', {
        ...baseConfig,
        filename: '/node_modules/rollup/dist/es/rollup.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        environmentKeys: ['node', 'import', 'require', 'default'],
        mainFields: ['module', 'main'],
        aliasFields: [],
      });
      expect(resolved).toBe('/node_modules/rollup/dist/es/rollup.js');
    });

    it('should ignore the closest package.json and aliases in it when exports are available in the root', () => {
      const resolved = resolver.resolveSync('@emotion/react/jsx-runtime', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        environmentKeys: ['browser', 'development', 'default', 'require', 'import'],
        mainFields: ['module', 'browser', 'main', 'jsnext:main'],
        aliasFields: ['browser', 'alias'],
        isFile,
        readFile,
      });
      expect(resolved).toBe('/node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.cjs.js');
    });

    it('should always use exports from the root of the package and not from the closest package.json', () => {
      const resolved = resolver.resolveSync('exports-from-root/nested', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        environmentKeys: ['browser', 'development', 'default', 'require', 'import'],
        mainFields: ['module', 'browser', 'main', 'jsnext:main'],
        aliasFields: ['browser', 'alias'],
        isFile,
        readFile,
      });
      // this should specifically not resolve to `/node_modules/exports-from-root/nested/file.js`
      // package.json#exports should only be used from the root of the package
      expect(resolved).toBe('/node_modules/exports-from-root/file.js');
    });

    it('should handle conditional root exports', () => {
      const resolved = resolver.resolveSync('its-fine', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        environmentKeys: ['browser', 'development', 'default', 'require', 'import'],
        mainFields: ['module', 'browser', 'main', 'jsnext:main'],
        aliasFields: ['browser', 'alias'],
        isFile,
        readFile,
      });
      expect(resolved).toBe('/node_modules/its-fine/out/index.cjs');
    });

    it('resolve fflate correctly', () => {
      const resolved = resolver.resolveSync('fflate', {
        ...baseConfig,
        filename: '/node_modules/its-fine/out/index.cjs',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        environmentKeys: ['browser', 'development', 'default', 'require', 'import'],
        mainFields: ['module', 'browser', 'main', 'jsnext:main'],
        aliasFields: ['browser', 'alias'],
        isFile,
        readFile,
      });
      expect(resolved).toBe('/node_modules/fflate/lib/index.cjs');
    });

    // We should still post process imports using the browser field even when a package has exports
    it('resolve fflate#worker correctly to browser version', () => {
      const resolved = resolver.resolveSync('./node-worker.cjs', {
        ...baseConfig,
        filename: '/node_modules/fflate/lib/index.cjs',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        environmentKeys: ['browser', 'development', 'default', 'require', 'import'],
        mainFields: ['module', 'browser', 'main', 'jsnext:main'],
        aliasFields: ['browser', 'alias'],
        isFile,
        readFile,
      });
      expect(resolved).toBe('/node_modules/fflate/lib/worker.cjs');
    });
  });

  describe('package#imports', () => {
    it('chalk', () => {
      const resolved = resolver.resolveSync('#ansi-styles', {
        ...baseConfig,
        filename: '/node_modules/chalk/index.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        environmentKeys: ['node', 'import', 'require', 'default'],
        mainFields: ['module', 'main'],
        aliasFields: [],
      });
      expect(resolved).toBe('/node_modules/chalk/source/vendor/ansi-styles/index.js');
    });

    it('chalk from sub-dir', () => {
      const resolved = resolver.resolveSync('#ansi-styles', {
        ...baseConfig,
        filename: '/node_modules/chalk/source/index.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        environmentKeys: ['node', 'import', 'require', 'default'],
        mainFields: ['module', 'main'],
        aliasFields: [],
      });
      expect(resolved).toBe('/node_modules/chalk/source/vendor/ansi-styles/index.js');
    });

    it('imports glob', () => {
      const resolved = resolver.resolveSync('#test/a', {
        ...baseConfig,
        filename: '/node_modules/imports-glob/index.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        environmentKeys: ['node', 'import', 'require', 'default'],
        mainFields: ['module', 'main'],
        aliasFields: [],
      });
      expect(resolved).toBe('/node_modules/imports-glob/source/vendor/test/a.js');
    });
  });

  describe('normalize module specifier', () => {
    it('normalize module specifier', () => {
      expect(normalizeModuleSpecifier('/test//fluent-d')).toBe('/test/fluent-d');
      expect(normalizeModuleSpecifier('//node_modules/react/')).toBe('/node_modules/react');
      expect(normalizeModuleSpecifier('./foo.js')).toBe('./foo.js');
      expect(normalizeModuleSpecifier('react//test')).toBe('react/test');
    });
  });

  describe('tsconfig', () => {
    it('should be able to resolve relative to basePath of tsconfig.json', () => {
      const resolved = resolver.resolveSync('app', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/src/app/index.js');
    });

    it('should be able to resolve paths that are simple aliases', () => {
      const resolved = resolver.resolveSync('something-special', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/src/app/something.js');
    });

    it('should be able to resolve wildcard paths with single char', () => {
      const resolved = resolver.resolveSync('~/app_config/test', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/src/app_config/test.js');
    });

    it('should be able to resolve wildcard paths with name', () => {
      const resolved = resolver.resolveSync('@app/something', {
        ...baseConfig,
        filename: '/foo.js',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });
      expect(resolved).toBe('/src/app/something.js');
    });
  });
});
