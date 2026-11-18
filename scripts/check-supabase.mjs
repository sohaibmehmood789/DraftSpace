const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Set the Supabase Project URL and publishable key in .env.local first.');
  process.exit(1);
}

try {
  const headers = { apikey: key };
  const auth = await fetch(`${url}/auth/v1/settings`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!auth.ok) throw new Error(`Supabase Auth returned HTTP ${auth.status}. Check the project URL and key.`);
  console.log('Supabase connection: OK');

  for (const table of ['profiles', 'documents', 'document_shares']) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    if (body.code === 'PGRST205') {
      console.error(`${table}: missing. Apply the SQL migration using supabase/README.md.`);
      process.exitCode = 1;
    } else if (body.code === '42501' && [401, 403].includes(response.status)) {
      console.log(`${table}: exists; anonymous access denied as expected.`);
    } else {
      console.error(`${table}: unexpected HTTP ${response.status}. Check that the full migration was applied.`);
      process.exitCode = 1;
    }
  }
  console.log('This checks connectivity, table presence, and anonymous grants. Login and sharing require signed-in verification.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Supabase connection check failed.');
  process.exitCode = 1;
}
