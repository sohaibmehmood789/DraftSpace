import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentEditor } from "@/components/documents/document-editor";
import { isDocumentId, validateContent } from "@/lib/documents/schema";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocumentId(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: document, error } = await supabase.from("documents")
    .select("id, title, content, owner_id, updated_at").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load the document.");
  if (!document) notFound();
  const content = validateContent(document.content);
  return <DocumentEditor key={document.id} document={{ ...document, content }} isOwner={document.owner_id === user.id} />;
}
