import { FilesRegister } from '../../lib/FilesRegister';

describe('[UNIT] FilesRegister', () => {
  let register;
  beforeEach(() => {
    register = new FilesRegister(
      () =>
        ({
          test: true
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
    );
  });

  it('should add and remove files', () => {
    register.add('/test');
    register.add('/test2');
    expect(register.has('/test')).toBe(true);
    expect(register.has('/test2')).toBe(true);
    register.remove('/test');
    expect(register.has('/test')).toBe(false);
    expect(register.has('/test2')).toBe(true);

    expect(function() {
      register.remove('/test');
    }).not.toThrowError();
    register.remove('/test2');
    expect(register.has('/test')).toBe(false);
    expect(register.has('/test2')).toBe(false);
  });

  it('should get file that exists in register', () => {
    register.add('/test');
    expect(function() {
      register.get('/test');
    }).not.toThrowError();
    expect(function() {
      register.get('/test2');
    }).toThrowError();
    expect(typeof register.get('/test')).toBe('object');
    expect(Object.keys(register.get('/test'))).toEqual(['mtime', 'data']);
  });

  it('should list all keys in register', () => {
    register.add('/test');
    register.add('/test/foo');
    register.add('/test/foo/bar');
    expect(register.keys()).toEqual(['/test', '/test/foo', '/test/foo/bar']);

    register.remove('/test');
    expect(register.keys()).toEqual(['/test/foo', '/test/foo/bar']);
  });

  it('should get data from file', () => {
    register.add('/test');
    expect(register.getData('/test')).toEqual({ test: true });
    expect(function() {
      register.getData('/test2');
    }).toThrowError(Error);
  });

  it('should ensure if file exists', () => {
    expect(register.has('/test')).toBe(false);
    register.ensure('/test');
    expect(register.has('/test')).toBe(true);

    const reference = register.get('/test');
    register.ensure('/test');
    expect(reference).toBe(register.get('/test'));
  });

  it('should mutate existing data', () => {
    register.add('/test');
    const dataReference = register.getData('/test');
    expect(dataReference.test).toBe(true);
    register.mutateData('/test', function(data) {
      data.test = false;
    });
    expect(dataReference).toBe(register.getData('/test'));
    expect(dataReference.test).toBe(false);
  });

  it('should set mtime and reset data if mtime changes', () => {
    register.add('/test');
    register.mutateData('/test', function(data) {
      data.test = false;
    });
    expect(register.getData('/test').test).toBe(false);
    expect(register.getMtime('/test')).toBeUndefined();

    register.setMtime('/test', 1000);
    expect(register.getMtime('/test')).toBe(1000);
    expect(register.getData('/test').test).toBe(true);
    register.mutateData('/test', function(data) {
      data.test = false;
    });
    expect(register.getData('/test').test).toBe(false);

    register.setMtime('/test', 1000);
    expect(register.getMtime('/test')).toBe(1000);
    expect(register.getData('/test').test).toBe(false);

    register.setMtime('/test', 1001);
    expect(register.getMtime('/test')).toBe(1001);
    expect(register.getData('/test').test).toBe(true);
  });
});
