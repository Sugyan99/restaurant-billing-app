"use client";
import { useRef, useState, useCallback } from "react";
interface ImageUploadProps { value?: string|null; onChange:(url:string|null)=>void; className?:string; }
export default function ImageUpload({ value, onChange, className="" }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Only image files allowed"); return; }
    if (file.size > 5*1024*1024) { setError("Max file size is 5 MB"); return; }
    setError(""); setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method:"POST", body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Upload failed");
      onChange(data.url);
    } catch(e:unknown) { setError(e instanceof Error?e.message:"Upload failed"); }
    finally { setUploading(false); }
  }, [onChange]);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0]; if(file) upload(file);
  }, [upload]);
  return (
    <div className={`img-u-root ${className}`}>
      {value ? (
        <div className="img-u-preview">
          <img src={value} alt="Item" style={{width:"100%",height:"100%",objectFit:"cover",display:"block",borderRadius:"12px"}} loading="lazy"/>
          <div className="img-u-actions">
            <button type="button" onClick={()=>inputRef.current?.click()} title="Replace" style={{background:"rgba(13,13,32,.85)",border:"1px solid rgba(255,255,255,.15)",color:"#94a3b8",borderRadius:"8px",padding:"6px 10px",cursor:"pointer",fontSize:"12px",backdropFilter:"blur(8px)"}}>Replace</button>
            <button type="button" onClick={()=>{onChange(null);setError("");}} title="Remove" style={{background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",color:"#f87171",borderRadius:"8px",padding:"6px 10px",cursor:"pointer",fontSize:"12px"}}>Remove</button>
          </div>
        </div>
      ) : (
        <div className={`img-u-drop${dragging?" dragging":""}${uploading?" uploading":""}`}
          onClick={()=>!uploading&&inputRef.current?.click()}
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={onDrop}
          role="button" tabIndex={0} aria-label="Upload image"
          onKeyDown={e=>e.key==="Enter"&&inputRef.current?.click()}>
          {uploading?<div className="img-u-spinner"/>:<>
            <span style={{fontSize:"28px"}}>📷</span>
            <span style={{fontSize:"13px",fontWeight:500}}>{dragging?"Drop to upload":"Drag & drop or click"}</span>
            <span style={{fontSize:"11px",color:"#475569"}}>PNG, JPG, WebP · max 5 MB</span>
          </>}
        </div>
      )}
      {error&&<p style={{fontSize:"12px",color:"#f87171",margin:0}} role="alert">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);e.target.value="";}} disabled={uploading}/>
      <style jsx>{`
        .img-u-root{display:flex;flex-direction:column;gap:6px}
        .img-u-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:28px 16px;background:rgba(255,255,255,.03);border:2px dashed rgba(255,255,255,.12);border-radius:14px;cursor:pointer;transition:all .15s;color:#64748b;user-select:none}
        .img-u-drop:hover,.img-u-drop.dragging{border-color:rgba(99,102,241,.5);background:rgba(99,102,241,.05);color:#94a3b8}
        .img-u-drop.uploading{cursor:default;opacity:.7}
        .img-u-preview{position:relative;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.10);background:#0d0d20;aspect-ratio:16/9}
        .img-u-actions{position:absolute;top:8px;right:8px;display:flex;gap:6px;opacity:0;transition:opacity .2s}
        .img-u-preview:hover .img-u-actions{opacity:1}
        .img-u-spinner{width:32px;height:32px;border:3px solid rgba(99,102,241,.2);border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
