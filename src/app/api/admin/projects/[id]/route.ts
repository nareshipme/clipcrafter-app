import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(userId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, r2_key, audio_key")
    .eq("id", id)
    .single();

  if (error || !project) return Response.json({ error: "Project not found" }, { status: 404 });

  const r2Keys: string[] = [];
  const p = project as { id: string; r2_key?: string | null; audio_key?: string | null };
  if (p.r2_key && !p.r2_key.startsWith("http")) r2Keys.push(p.r2_key);
  if (p.audio_key) r2Keys.push(p.audio_key as string);

  await Promise.allSettled(
    r2Keys.map((key) => r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })))
  );

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

  const { error: deleteError } = await supabaseAdmin.from("projects").delete().eq("id", id);

  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  return Response.json({ ok: true });
}
