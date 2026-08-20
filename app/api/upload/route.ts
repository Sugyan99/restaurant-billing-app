import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "menu-images";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg","image/png","image/webp","image/gif"];

// Lazy init — avoids "supabaseUrl is required" crash at build time
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let verifyToken: ((t: string) => any) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/auth");
  verifyToken = m.verifyToken ?? m.default?.verifyToken;
} catch {}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error:"Unauthorized" }, { status:401 });

    let tenantId = "default";
    if (verifyToken) {
      const p = verifyToken(token);
      if (!p) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
      if (typeof p.tenantId === "string") tenantId = p.tenantId;
    }

    const form = await req.formData();
    const file = form.get("file") as File|null;
    if (!file) return NextResponse.json({ error:"No file" }, { status:400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error:"Invalid file type" }, { status:400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error:"Max 5 MB" }, { status:400 });

    const ext = (file.name.split(".").pop()??"jpg").toLowerCase();
    const path = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());

    const supabase = getSupabase();
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType:file.type, upsert:false });
    if (upErr) { console.error("[upload]", upErr.message); return NextResponse.json({ error:"Upload failed" }, { status:500 }); }

    const { data:{ publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: publicUrl });
  } catch (e) {
    console.error("[upload] POST:", e);
    return NextResponse.json({ error:"Internal server error" }, { status:500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error:"Unauthorized" }, { status:401 });

    const { url } = (await req.json()) as { url?:string };
    if (!url) return NextResponse.json({ error:"No URL" }, { status:400 });

    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return NextResponse.json({ error:"Invalid URL" }, { status:400 });
    const filePath = url.slice(idx + marker.length);

    const supabase = getSupabase();
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) return NextResponse.json({ error:"Delete failed" }, { status:500 });
    return NextResponse.json({ ok:true });
  } catch (e) {
    console.error("[upload] DELETE:", e);
    return NextResponse.json({ error:"Internal server error" }, { status:500 });
  }
}
