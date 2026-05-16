import { validate } from 'schema-utils';
import type { Schema } from 'schema-utils';

describe('schema-utils upgrade', () => {
  it('schema-utils v4 is installed and validate function is available', () => {
    // This test verifies that the schema-utils upgrade works correctly
    expect(typeof validate).toBe('function');
  });

  it('can validate simple schema with schema-utils v4', () => {
    const schema: Schema = {
      type: 'object',
      properties: {
        debug: { type: 'boolean' },
      },
    };

    const config = { name: 'TestSchema' };

    // Valid options should not throw
    expect(() => {
      validate(schema, { debug: true }, config);
    }).not.toThrow();
  });

  it('schema-utils v4 supports ajv-based validation', () => {
    const schema: Schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      additionalProperties: false,
    };

    const config = { name: 'PluginOptions' };

    // Should throw for invalid options (wrong type)
    expect(() => {
      validate(schema, { name: 12345 }, config);
    }).toThrow();
  });
});