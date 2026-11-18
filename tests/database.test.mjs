import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const owner = '11111111-1111-4111-8111-111111111111';
const editor = '22222222-2222-4222-8222-222222222222';
const stranger = '33333333-3333-4333-8333-333333333333';
const document = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('database migration enforces document ownership and sharing', async (t) => {
  const db = new PGlite();
  try {
    // Reproduce the Supabase identity boundary. Only the test harness sets JWT IDs.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (
        id uuid primary key, email text unique,
        raw_user_meta_data jsonb not null default '{}'::jsonb
      );
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated;
    `);
    await db.query('insert into auth.users(id, email) values ($1, $2)', [owner, 'owner@example.com']);
    await db.exec(await readFile(new URL('../supabase/migrations/202611180001_initial_schema.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611180002_list_document_shares.sql', import.meta.url), 'utf8'));
    await db.query(`insert into auth.users(id, email, raw_user_meta_data) values
      ($1, 'editor@example.com', '{"display_name":"Editor"}'),
      ($2, 'stranger@example.com', '{}')`, [editor, stranger]);

    async function asUser(id) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
      await db.exec(id ? 'set role authenticated' : 'set role anon');
    }

    await t.test('profiles are backfilled and created by the auth trigger', async () => {
      const result = await db.query('select display_name from public.profiles order by id');
      assert.deepEqual(result.rows.map((r) => r.display_name), ['owner', 'Editor', 'stranger']);
    });

    await t.test('owner creates a document; others cannot read or edit it', async () => {
      await asUser(owner);
      await db.query('insert into public.documents(id, owner_id, title) values ($1, $2, $3)', [document, owner, 'Private draft']);
      await asUser(stranger);
      assert.equal((await db.query('select * from public.documents')).rows.length, 0);
      assert.equal((await db.query("update public.documents set title='Stolen' returning id")).rows.length, 0);
      await assert.rejects(db.query('insert into public.documents(owner_id) values ($1)', [owner]), /row-level security/);
    });

    await t.test('only owner can share; repeated sharing is harmless', async () => {
      await asUser(stranger);
      await assert.rejects(db.query('select public.share_document($1, $2)', [document, 'editor@example.com']), /Only the document owner/);
      await asUser(owner);
      await assert.rejects(db.query('select public.share_document($1, $2)', [document, 'missing@example.com']), /No registered user/);
      await assert.rejects(db.query('select public.share_document($1, $2)', [document, 'owner@example.com']), /already own/);
      await db.query('select public.share_document($1, $2)', [document, ' EDITOR@example.com ']);
      await db.query('select public.share_document($1, $2)', [document, 'editor@example.com']);
      assert.equal((await db.query('select * from public.document_shares')).rows.length, 1);
    });

    await t.test('only the owner can list recipient identities', async () => {
      await asUser(owner);
      const result = await db.query('select * from public.list_document_shares($1)', [document]);
      assert.deepEqual(result.rows, [{ shared_with: editor, display_name: 'Editor', email: 'editor@example.com' }]);
      for (const user of [editor, stranger]) {
        await asUser(user);
        await assert.rejects(db.query('select * from public.list_document_shares($1)', [document]), /Only the document owner/);
      }
    });

    await t.test('shared editor reads and persists rich text but cannot take ownership or share', async () => {
      await asUser(editor);
      assert.equal((await db.query('select * from public.documents')).rows.length, 1);
      const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }] }] }] };
      await db.query('update public.documents set content=$1 where id=$2', [JSON.stringify(content), document]);
      assert.deepEqual((await db.query('select content from public.documents')).rows[0].content, content);
      await assert.rejects(db.query('update public.documents set owner_id=$1 where id=$2', [editor, document]), /permission denied/);
      await assert.rejects(db.query('select public.share_document($1, $2)', [document, 'stranger@example.com']), /Only the document owner/);
      await assert.rejects(db.query('insert into public.document_shares(document_id, shared_with) values ($1, $2)', [document, stranger]), /permission denied/);
      assert.equal((await db.query('delete from public.documents returning id')).rows.length, 0);
      assert.equal((await db.query('delete from public.document_shares returning document_id')).rows.length, 0);
    });

    await t.test('title and document structure validation rejects invalid saves', async () => {
      await asUser(owner);
      for (const title of ['', '   ', 'x'.repeat(201)]) {
        await assert.rejects(db.query('update public.documents set title=$1', [title]), /check constraint/);
      }
      for (const content of [{}, { type: 'doc' }, { type: 'doc', content: {} }, { type: 'other', content: [] }]) {
        await assert.rejects(db.query('update public.documents set content=$1', [JSON.stringify(content)]), /check constraint/);
      }
    });

    await t.test('revoking a share immediately removes read and write access', async () => {
      await asUser(owner);
      await db.query('delete from public.document_shares where document_id=$1 and shared_with=$2', [document, editor]);
      await asUser(editor);
      assert.equal((await db.query('select * from public.documents')).rows.length, 0);
      assert.equal((await db.query("update public.documents set title='Revoked' returning id")).rows.length, 0);
    });

    await t.test('anonymous clients have no document or sharing access', async () => {
      await asUser(null);
      await assert.rejects(db.query('select * from public.documents'), /permission denied/);
      await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
      await assert.rejects(db.query('select * from public.list_document_shares($1)', [document]), /permission denied/);
      await assert.rejects(db.query('select public.share_document($1, $2)', [document, 'editor@example.com']), /permission denied/);
    });
  } finally {
    await db.close();
  }
});
