import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTitle, validateContent, EMPTY_DOCUMENT } from '../src/lib/documents/schema.ts';

test('document validation preserves formatted text and lists', () => {
  const content = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Heading' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Formatted', marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }] }] },
    { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step' }] }] }] },
  ] };
  const normalized = validateContent(content);
  assert.equal(Object.getPrototypeOf(normalized.content[0].attrs), Object.prototype,
    'formatted content must cross the React server/client boundary as plain objects');
  assert.equal(normalized.content[0].type, 'heading');
  assert.deepEqual(normalized.content[1].content[0].marks, content.content[1].content[0].marks);
  assert.equal(normalized.content[2].type, 'bulletList');
  assert.equal(normalized.content[3].type, 'orderedList');
  assert.deepEqual(validateContent(EMPTY_DOCUMENT), EMPTY_DOCUMENT);
});

test('invalid and unsafe rich text structures cannot be saved', () => {
  for (const content of [null, {}, { type: 'doc', content: [] }, { type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] }, { type: 'doc', content: [{ type: 'text', text: 'Text outside a block' }] }]) {
    assert.throws(() => validateContent(content));
  }
  const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(500_001) }] }] };
  assert.throws(() => validateContent(content), /too large/);
  let deep = { type: 'paragraph' };
  for (let i = 0; i < 45; i++) deep = { type: 'bulletList', content: [deep] };
  assert.throws(() => validateContent({ type: 'doc', content: [deep] }), /too complex/);
});

test('document titles reject blanks and stay within the database limit', () => {
  assert.equal(validateTitle('  Team notes  '), 'Team notes');
  for (const title of ['', '  ', null, 'x'.repeat(201)]) assert.throws(() => validateTitle(title));
});
