"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/context/AppData";
import { builtinByTitle, builtinProblem, slugFromUrl } from "@/lib/catalog";
import { csvRecords, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { Overlay } from "./overlays";
import { diffText, Kbd } from "./ui";

const COLUMNS = ["title", "url", "difficulty", "topic", "note", "reviewed_at", "grade"];
const TEMPLATE = toCsv([COLUMNS, ["Two Sum", "https://leetcode.com/problems/two-sum/", "Easy", "Arrays & Hashing", "", "", ""], ["Rate limiter", "", "Hard", "System Design", "asked at an onsite", "", ""]]);

type Status = "ready" | "in list" | "fix";

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { data, reload } = useApp();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ problems: number; reviews: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!file || !data) return null;
    const recs = csvRecords(file.text);
    const header = Object.keys(recs[0] ?? {});
    const titleCol = header.includes("title");
    const custom = new Set(data.customProblems.map((p) => p.title.toLowerCase()));
    const rows = recs.map((r, i) => {
      const id = (r.url && slugFromUrl(r.url)) || builtinByTitle(r.title ?? "")?.id;
      const known = (id && data.myList.includes(id)) || custom.has((r.title ?? "").toLowerCase());
      const status: Status = !r.title ? "fix" : known && !r.reviewed_at ? "in list" : "ready";
      return { n: i + 2, r, status, difficulty: r.difficulty || (id && builtinProblem(id)?.difficulty) || "" };
    });
    return { header, titleCol, rows, ready: rows.filter((x) => x.status === "ready").length, inList: rows.filter((x) => x.status === "in list").length, fix: rows.filter((x) => x.status === "fix").length };
  }, [file, data]);

  const load = async (f: File | undefined) => { if (!f) return; setResult(null); setError(null); setFile({ name: f.name, text: await f.text() }); };
  const doImport = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/import", { method: "POST", body: file.text });
      const out = (await res.json()) as { error?: string; problems: number; reviews: number; skipped: number; errors: string[] };
      if (!res.ok) throw new Error(out.error ?? "Import failed");
      setResult(out); await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const pill = (n: number, label: string, cls: string) => <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", cls)}><span className="size-1.5 rounded-full bg-current" />{n} {label}</span>;
  return (
    <Overlay onClose={onClose} label="Import CSV" className="top-[8vh] max-h-[84vh] w-[860px] max-w-[calc(100vw-32px)] space-y-4 overflow-y-auto p-7">
      <div className="flex items-start">
        <div className="flex-1"><h2 className="text-xl font-bold">Import CSV to My list</h2><p className="text-[13px] text-muted-foreground">Bare rows join My list. Rows with reviewed_at add history and rebuild the schedule.</p></div>
        <Kbd>Esc</Kbd>
      </div>
      <label className="flex cursor-pointer items-center gap-3.5 rounded-lg border-[1.5px] border-dashed border-primary bg-primary-tint px-4 py-3.5"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files[0]); }}>
        <span className="flex size-10 items-center justify-center rounded-md bg-card font-mono text-[11px] font-semibold text-primary">CSV</span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">{file ? file.name : "Drop a .csv here or click to choose"}</span>
          <span className="block text-xs text-muted-foreground">{preview ? `${preview.rows.length} rows · drop another file to replace` : "Columns: " + COLUMNS.join(", ") + " (only title is required)"}</span>
        </span>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="recursify-template.csv" onClick={(e) => e.stopPropagation()} className="text-[13px] font-medium text-primary">Download template</a>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
      </label>

      {preview && !preview.titleCol ? (
        <p className="rounded-md bg-forgot-tint px-3 py-2.5 text-[13px] font-medium text-forgot-text">No “title” column found. Found: {preview.header.join(", ") || "nothing"}. Rename your title column to “title” and drop the file again.</p>
      ) : null}
      {preview && preview.titleCol ? (
        <>
          <div className="flex flex-wrap gap-2">
            {pill(preview.ready, "ready", "bg-recalled-tint text-recalled-text")}
            {preview.inList ? pill(preview.inList, "already in list · skipped", "bg-struggled-tint text-struggled-text") : null}
            {preview.fix ? pill(preview.fix, "need a title · skipped", "bg-forgot-tint text-forgot-text") : null}
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex gap-3 bg-muted px-3.5 py-2 font-mono text-[10px] text-muted-foreground"><span className="w-10">ROW</span><span className="flex-1">TITLE</span><span className="w-24">DIFFICULTY</span><span className="w-40">TOPIC</span><span className="w-36">STATUS</span></div>
            {preview.rows.slice(0, 8).map((x) => (
              <div key={x.n} className={cn("flex gap-3 border-t border-border px-3.5 py-2 text-[13px]", x.status === "fix" && "bg-forgot-tint", x.status === "in list" && "bg-struggled-tint")}>
                <span className="w-10 font-mono text-xs text-muted-foreground">{x.n}</span>
                <span className="flex-1 truncate font-medium">{x.r.title || <em className="text-forgot-text">title missing</em>}</span>
                <span className={cn("w-24 text-xs font-semibold", diffText[x.difficulty as keyof typeof diffText] ?? "text-muted-foreground")}>{x.difficulty || "→ Medium"}</span>
                <span className="w-40 truncate text-foreground-2">{x.r.topic || "—"}</span>
                <span className={cn("w-36 text-xs font-medium", { ready: "text-recalled-text", "in list": "text-struggled-text", fix: "text-forgot-text" }[x.status])}>{x.status === "fix" ? "title missing" : x.status === "in list" ? "already in list" : x.r.reviewed_at ? `ready · review ${x.r.reviewed_at}` : "ready"}</span>
              </div>
            ))}
            {preview.rows.length > 8 ? <p className="border-t border-border px-3.5 py-2 text-xs text-muted-foreground">+ {preview.rows.length - 8} more rows</p> : null}
          </div>
        </>
      ) : null}

      {result ? <p className="rounded-md bg-recalled-tint px-3 py-2.5 text-[13px] font-medium text-recalled-text">Imported {result.problems} problems and {result.reviews} reviews{result.skipped ? ` · ${result.skipped} duplicates skipped` : ""}{result.errors.length ? ` · ${result.errors.length} rows had errors: ${result.errors.slice(0, 3).join("; ")}` : ""}.</p> : null}
      {error ? <p className="rounded-md bg-forgot-tint px-3 py-2.5 text-[13px] font-medium text-forgot-text">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-border px-3.5 py-2 text-[13px] font-semibold">{result ? "Done" : "Cancel"}</button>
        {!result ? <button type="button" disabled={!preview?.titleCol || !preview.ready || busy} onClick={doImport} className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40">{busy ? "Importing…" : `Import ${preview?.ready ?? 0} ${preview?.ready === 1 ? "row" : "rows"}`}</button> : null}
      </div>
    </Overlay>
  );
}
