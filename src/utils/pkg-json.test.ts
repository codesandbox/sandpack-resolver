import fs from 'fs';
import path from 'path/posix';

import { processPackageJSON } from './pkg-json';

const FIXTURE_PATH = path.join(__dirname, '../fixture');

// alias/exports/main keys, sorted from high to low priority
const MAIN_PKG_FIELDS = ['module', 'browser', 'main', 'jsnext:main'];
const PKG_ALIAS_FIELDS = ['browser', 'alias'];
const EXPORTS_KEYS = ['browser', 'development', 'default', 'require', 'import'];

describe('process package.json', () => {
  it('Should correctly process pkg.exports from @babel/runtime', () => {
    const content = JSON.parse(
      fs.readFileSync(path.join(FIXTURE_PATH, 'node_modules/@babel/runtime/package.json'), 'utf-8')
    );
    const processedPkg = processPackageJSON(
      content,
      '/node_modules/@babel/runtime',
      MAIN_PKG_FIELDS,
      PKG_ALIAS_FIELDS,
      EXPORTS_KEYS
    );
    expect(processedPkg).toMatchSnapshot();
  });

  it('Should correctly handle nested pkg#exports fields (solid-js)', () => {
    const content = JSON.parse(fs.readFileSync(path.join(FIXTURE_PATH, 'node_modules/solid-js/package.json'), 'utf-8'));
    const processedPkg = processPackageJSON(
      content,
      '/node_modules/solid-js',
      MAIN_PKG_FIELDS,
      PKG_ALIAS_FIELDS,
      EXPORTS_KEYS
    );
    expect(processedPkg).toMatchSnapshot();
  });

  it('Should correctly handle root pkg.json', () => {
    const content = JSON.parse(fs.readFileSync(path.join(FIXTURE_PATH, 'package.json'), 'utf-8'));
    const processedPkg = processPackageJSON(content, '/', MAIN_PKG_FIELDS, PKG_ALIAS_FIELDS, EXPORTS_KEYS);
    expect(processedPkg).toMatchSnapshot();
  });
});
