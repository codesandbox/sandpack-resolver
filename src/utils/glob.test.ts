import { replaceGlob } from './glob';

describe('glob utils', () => {
  it.only('foo', () => {
    expect(replaceGlob('/@test/test/*', '/@test/test/dist/*', '/@test/test/dist/index')).toBe('/@test/test/dist/index');
  });

  it('replace glob at the end', () => {
    expect(replaceGlob('#test/*', './something/*/index.js', '#test/hello')).toBe('./something/hello/index.js');
  });

  it('replace glob in the middle', () => {
    expect(replaceGlob('#test/*.js', './test/*.js', '#test/hello.js')).toBe('./test/hello.js');
  });
});
