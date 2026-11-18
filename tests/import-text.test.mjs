import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_IMPORT_BYTES, parseTextFile } from '../src/lib/documents/import-text.ts';

test('UTF-8 import preserves Unicode, literal markup, blank lines, and normalizes line endings', async () => {
  const file = new File(['\uFEFFHello café 👋\r\n\r\n<script>alert("text")</script>\rLast line'], 'Team notes.TXT', { type: 'text/plain' });
  const result = await parseTextFile(file);
  assert.equal(result.title, 'Team notes');
  assert.deepEqual(result.content, { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello café 👋' }] },
    { type: 'paragraph' },
    { type: 'paragraph', content: [{ type: 'text', text: '<script>alert("text")</script>' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Last line' }] },
  ] });
});

test('unsupported, empty, oversized, malformed UTF-8, and binary files are rejected', async () => {
  const cases = [
    [new File(['hello'], 'notes.md'), /Only .txt/],
    [new File([], 'empty.txt'), /empty/],
    [new File([' \n\t'], 'blank.txt'), /empty/],
    [new File(['x'.repeat(MAX_IMPORT_BYTES + 1)], 'big.txt'), /too large/],
    [new File([new Uint8Array([0xc3, 0x28])], 'bad.txt'), /UTF-8/],
    [new File(['text\0binary'], 'binary.txt'), /binary/],
  ];
  for (const [file, error] of cases) await assert.rejects(parseTextFile(file), error);
});

test('the size boundary and safe filename titles are handled consistently', async () => {
  const full = await parseTextFile(new File(['x'.repeat(MAX_IMPORT_BYTES)], 'limit.txt'));
  assert.equal(full.content.content[0].content[0].text.length, MAX_IMPORT_BYTES);
  assert.equal((await parseTextFile(new File(['Text'], '.txt'))).title, 'Imported document');
  assert.equal((await parseTextFile(new File(['Text'], 'x'.repeat(240) + '.txt'))).title.length, 200);
  assert.equal((await parseTextFile(new File(['Text'], 'folder/notes.final.txt'))).title, 'notes.final');
});
