import { replaceGlob } from './glob';

describe('glob utils', () => {
  it('replace glob at the end', () => {
    expect(replaceGlob('#test/*', './something/*/index.js', '#test/hello')).toBe('./something/hello/index.js');
  });

  it('replace glob in the middle', () => {
    expect(replaceGlob('#test/*.js', './test/*.js', '#test/hello.js')).toBe('./test/hello.js');
  });
});
