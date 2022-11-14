import nodePath from 'path/posix';
import * as pathUtils from './path';

describe('path utils', () => {
  it('join paths', () => {
    const tests = [
      ['a', 'b', 'c'],
      ['/root', '/abc', 'hello/'],
      ['../test', 'abc', 'eee'],
      ['hello', '../world'],
      ['/abc/test/', 'hello/world', 'c'],
    ];
    for (const test of tests) {
      expect(pathUtils.join(...test)).toBe(nodePath.join(...test));
    }
  });

  it('simplify slashes', () => {
    expect(pathUtils.simplifySlashes('//test//reerer/eweu/')).toBe('/test/reerer/eweu/');
    expect(pathUtils.simplifySlashes('//test/\\/reerer/eweu/')).toBe('/test/reerer/eweu/');
    expect(pathUtils.simplifySlashes('/')).toBe('/');
    expect(pathUtils.simplifySlashes('\\something\\something\\windows\\')).toBe('/something/something/windows/');
  });

  it('dirname', () => {
    expect(pathUtils.simplifySlashes('//test//reerer/eweu/')).toBe('/test/reerer/eweu/');
    expect(pathUtils.simplifySlashes('//test/\\/reerer/eweu/')).toBe('/test/reerer/eweu/');
    expect(pathUtils.simplifySlashes('/')).toBe('/');
    expect(pathUtils.simplifySlashes('\\something\\something\\windows\\')).toBe('/something/something/windows/');
  });
});
