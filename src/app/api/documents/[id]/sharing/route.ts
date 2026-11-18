import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDocumentId } from "@/lib/documents/schema";

type Client = Awaited<ReturnType<typeof createClient>>;
type OwnerAccess = { ok: true; supabase: Client } | { ok: false; response: Response };
type Context = { params: Promise<{ id: string }> };

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function requireOwner(id: string): Promise<OwnerAccess> {
  if (!isDocumentId(id)) return { ok: false, response: failure("Document unavailable.", 404) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: failure("Your session expired. Please sign in again.", 401) };
  const { data, error } = await supabase.from("documents").select("owner_id").eq("id", id).maybeSingle();
  if (error) return { ok: false, response: failure("We couldn’t check access. Please try again.", 500) };
  if (!data) return { ok: false, response: failure("Document unavailable.", 404) };
  if (data.owner_id !== user.id) return { ok: false, response: failure("Only the document owner can manage sharing.", 403) };
  return { ok: true, supabase };
}

async function accessList(supabase: Client, id: string) {
  const { data, error } = await supabase.rpc("list_document_shares", { target_document_id: id });
  if (error) return failure("We couldn’t load the access list. Please try again.", 500);
  return Response.json({ shares: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

async function readInput(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (text.length > 4096) return null;
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const access = await requireOwner(id);
  if (!access.ok) return access.response;
  return accessList(access.supabase, id);
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const access = await requireOwner(id);
  if (!access.ok) return access.response;
  const input = await readInput(request);
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return failure("Enter a valid registered email address.", 400);
  }
  const { error } = await access.supabase.rpc("share_document", { target_document_id: id, recipient_email: email });
  if (error) {
    if (error.code === "22023") return failure(error.message, 400);
    if (error.code === "42501") return failure("Only the document owner can manage sharing.", 403);
    return failure("We couldn’t grant access. Please try again.", 500);
  }
  revalidatePath("/documents");
  return accessList(access.supabase, id);
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const access = await requireOwner(id);
  if (!access.ok) return access.response;
  const input = await readInput(request);
  const recipient = input?.sharedWith;
  if (typeof recipient !== "string" || !isDocumentId(recipient)) return failure("Choose a valid recipient to remove.", 400);
  const { error } = await access.supabase.from("document_shares").delete().eq("document_id", id).eq("shared_with", recipient);
  if (error) return failure("We couldn’t remove access. Please try again.", 500);
  revalidatePath("/documents");
  return accessList(access.supabase, id);
}
