/**
 * DELETE /api/projects/[id]
 * Deletes a project and all its related data (transcripts, highlights, R2 files).
 *
 * PATCH /api/projects/[id]
 * Updates project fields. Currently supports: title.
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { getSupabaseUserId } from "@/lib/user";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const { id } = await params;
  const body = await request.json();
  const { title, r2_key } = body as { title?: string; r2_key?: string };

  if (title === undefined && r2_key === undefined) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }
  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    return Response.json({ error: "title must be a non-empty string" }, { status: 400 });
  }

  const { data: project, error: fetchError } = await supabaseAdmin
    .from("projects")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (fetchError || !project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.user_id !== supabaseUserId)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const updates: Record<string, string> = {};
  if (title !== undefined) updates.title = title.trim();
  if (r2_key !== undefined) updates.r2_key = r2_key;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select("id, title")
    .single();

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  return Response.json({ project: updated }, { status: 200 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const { id } = await params;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id, r2_key, audio_key")
    .eq("id", id)
    .single();

  if (error || !project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.user_id !== supabaseUserId)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  // Delete R2 files (best effort — don't fail if missing)
  const r2Keys: string[] = [];
  if (project.r2_key && !project.r2_key.startsWith("http")) r2Keys.push(project.r2_key);
  if (project.audio_key) r2Keys.push(project.audio_key);

  await Promise.allSettled(
    r2Keys.map((key) => r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })))
  );

  // Delete all exports and temp YouTube sources for this project (best effort)
  const prefixesToDelete = [`exports/${id}/`, `temp-sources/${id}/`];
  await Promise.allSettled(
    prefixesToDelete.map(async (prefix) => {
      const listed = await r2Client.send(
        new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix })
      );
      const objects = listed.Contents?.map((o) => ({ Key: o.Key! })) ?? [];
      if (objects.length === 0) return;
      await r2Client.send(
        new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: objects } })
      );
    })
  );

  // Delete from Supabase (cascades to transcripts + highlights via FK)
  const { error: deleteError } = await supabaseAdmin.from("projects").delete().eq("id", id);

  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  return Response.json({ ok: true }, { status: 200 });
}
