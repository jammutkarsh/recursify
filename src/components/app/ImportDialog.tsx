"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppData";
import { toCsv } from "@/lib/csv";
import { DEMO, demoApi } from "@/lib/demo";
import { loadCatalog, type CatalogProblem } from "@/lib/leetcode";
import { DEFAULT_LIST_ID } from "@/lib/settings";
import { CSV_COLUMNS, planImport, slugsToResolve, type Meta, type RowStatus } from "@/lib/transfer";
import { cn } from "@/lib/utils";
import { Overlay } from "./overlays";
import { diffText, Kbd, Picker } from "./ui";

const TEMPLATE = toCsv([CSV_COLUMNS, ["", "https://leetcode.com/problems/two-sum/", "", "Hash Table", "", "", "", ""], ["Rate limiter", "", "Hard", "System Design", "asked at an onsite", "", "", "Interviews"]]);
const NEW_LIST = "__new";
const STATUS: Record<RowStatus, [string, string]> = {
  new: ["ready", "text-recalled-text"], added: ["adds to list", "text-recalled-text"], review: ["adds history", "text-instant-text"],
  "in list": ["already in list", "text-struggled-text"], duplicate: ["duplicate · skipped", "text-struggled-text"], error: ["", "text-forgot-text"],
};

/** Import a CSV into a list. `listId` preselects the target (e.g. the list open in Library). */
export function ImportDialog({ onClose, listId }: { onClose: () => void; listId?: string }) {
  const { data, reload, createList } = useApp();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [target, setTarget] = useState(listId && data?.lists.some((l) => l.id === listId) ? listId : DEFAULT_LIST_ID);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ problems: number; reviews: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Map<string, CatalogProblem> | null>(null);
  useEffect(() => { if (file) loadCatalog().then(setCatalog, () => {}); }, [file]); // fills in rows that only have a link

  // The same planner the import itself runs, so the preview shows exactly what will happen.
  const preview = useMemo(() => {
    if (!file || !data) return null;
    try {
      const state = target === NEW_LIST ? { ...data, lists: [...data.lists, { id: NEW_LIST, name: newName.trim() || "New list", items: [] }] } : data;
      const meta = new Map<string, Meta | null>(slugsToResolve(file.text, state).map((s) => [s, catalog?.get(s) ?? null]));
      const plan = planImport(file.text, state, target, meta);
      const count = (s: RowStatus) => plan.rows.filter((r) => r.status === s).length;
      return { problem: null, rows: plan.rows, writes: plan.ops.length, added: count("added"), reviews: count("review"), inList: count("in list") + count("duplicate"), errors: count("error") };
    } catch (e) { return { problem: (e as Error).message, rows: [], writes: 0, added: 0, reviews: 0, inList: 0, errors: 0 }; }
  }, [file, data, catalog, target, newName]);

  const load = async (f: File | undefined) => { if (!f) return; setResult(null); setError(null); setFile({ name: f.name, text: await f.text() }); };
  const doImport = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const into = target === NEW_LIST ? await createList(newName) : target;
      if (!into) return; // createList showed why
      type Out = { error?: string; problems: number; reviews: number; skipped: number; errors: string[] };
      const path = `/api/import?list=${encodeURIComponent(into)}`;
      if (DEMO) setResult(await demoApi<Out>(path, { method: "POST", body: file.text }));
      else {
        const res = await fetch(path, { method: "POST", body: file.text });
        const out = (await res.json()) as Out;
        if (!res.ok) throw new Error(out.error ?? "Import failed");
        setResult(out);
      }
      if (target === NEW_LIST) setTarget(into);
      await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const pill = (n: number, label: string, cls: string) => <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", cls)}><span className="size-1.5 rounded-full bg-current" />{n} {label}</span>;
  const lists = data?.lists ?? [];
  return (
    <Overlay onClose={onClose} label="Import CSV" className="top-[8vh] max-h-[84vh] w-[860px] max-w-[calc(100vw-32px)] space-y-4 overflow-y-auto p-7">
      <div className="flex items-start">
        <div className="flex-1"><h2 className="text-xl font-bold">Import CSV</h2><p className="text-[13px] text-muted-foreground">Rows join the list you pick (or the one named in a “list” column). Rows with reviewed_at add history and rebuild the schedule.</p></div>
        <Kbd>Esc</Kbd>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium">Into</span>
        <Picker label="List to import into" value={target} onChange={setTarget} options={[...lists.map((l) => ({ value: l.id, label: l.name })), { value: NEW_LIST, label: "New list…" }]} />
        {target === NEW_LIST ? <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="List name, e.g. Patterns" aria-label="New list name" maxLength={60}
          className="h-9 w-64 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary" /> : null}
      </div>
      <label className="flex cursor-pointer items-center gap-3.5 rounded-lg border-[1.5px] border-dashed border-primary bg-primary-tint px-4 py-3.5"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files[0]); }}>
        <span className="flex size-10 items-center justify-center rounded-md bg-card font-mono text-[11px] font-semibold text-primary">CSV</span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">{file ? file.name : "Drop a .csv here or click to choose"}</span>
          <span className="block text-xs text-muted-foreground">{preview ? `${preview.rows.length} rows · drop another file to replace` : `Columns: ${CSV_COLUMNS.join(", ")}. A LeetCode link alone is enough; “topic” sets the section.`}</span>
        </span>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="recursify-template.csv" onClick={(e) => e.stopPropagation()} className="text-[13px] font-medium text-primary">Download template</a>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
      </label>

      {preview?.problem ? (
        <p className="rounded-md bg-forgot-tint px-3 py-2.5 text-[13px] font-medium text-forgot-text">{preview.problem} Name a column “title” or “url” (or upload just LeetCode links, one per line) and drop the file again.</p>
      ) : null}
      {preview && !preview.problem && !result ? (
        <>
          <div className="flex flex-wrap gap-2">
            {pill(preview.added, "to add", "bg-recalled-tint text-recalled-text")}
            {preview.reviews ? pill(preview.reviews, "with history", "bg-instant-tint text-instant-text") : null}
            {preview.inList ? pill(preview.inList, "already there · skipped", "bg-struggled-tint text-struggled-text") : null}
            {preview.errors ? pill(preview.errors, "need a fix · skipped", "bg-forgot-tint text-forgot-text") : null}
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex gap-3 bg-muted px-3.5 py-2 font-mono text-[10px] text-muted-foreground"><span className="w-10">LINE</span><span className="flex-1">TITLE</span><span className="w-20">DIFFICULTY</span><span className="w-36">TOPIC</span><span className="w-32">LIST</span><span className="w-36">STATUS</span></div>
            {preview.rows.slice(0, 8).map((x) => (
              <div key={x.line} className={cn("flex gap-3 border-t border-border px-3.5 py-2 text-[13px]", x.status === "error" && "bg-forgot-tint", (x.status === "in list" || x.status === "duplicate") && "bg-struggled-tint")}>
                <span className="w-10 font-mono text-xs text-muted-foreground">{x.line}</span>
                <span className="flex-1 truncate font-medium">{x.title || <em className="text-forgot-text">title or link missing</em>}</span>
                <span className={cn("w-20 text-xs font-semibold", diffText[x.difficulty as keyof typeof diffText] ?? "text-muted-foreground")}>{x.difficulty || "→ Medium"}</span>
                <span className="w-36 truncate text-foreground-2">{x.topic || "—"}</span>
                <span className="w-32 truncate text-foreground-2">{x.list || "—"}</span>
                <span className={cn("w-36 truncate text-xs font-medium", STATUS[x.status][1])}>{x.status === "error" ? x.error : STATUS[x.status][0]}</span>
              </div>
            ))}
            {preview.rows.length > 8 ? <p className="border-t border-border px-3.5 py-2 text-xs text-muted-foreground">+ {preview.rows.length - 8} more rows</p> : null}
          </div>
        </>
      ) : null}

      {result ? <p className="rounded-md bg-recalled-tint px-3 py-2.5 text-[13px] font-medium text-recalled-text">Added {result.problems} problems and {result.reviews} reviews{result.skipped ? ` · ${result.skipped} duplicates skipped` : ""}{result.errors.length ? ` · ${result.errors.length} rows had errors: ${result.errors.slice(0, 3).join("; ")}` : ""}.</p> : null}
      {error ? <p className="rounded-md bg-forgot-tint px-3 py-2.5 text-[13px] font-medium text-forgot-text">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-border px-3.5 py-2 text-[13px] font-semibold">{result ? "Done" : "Cancel"}</button>
        {!result ? <button type="button" disabled={!!preview?.problem || !preview?.writes || busy || (target === NEW_LIST && !newName.trim())} onClick={doImport}
          className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40">{busy ? "Importing…" : `Import ${preview?.rows.length ?? 0} ${preview?.rows.length === 1 ? "row" : "rows"}`}</button> : null}
      </div>
    </Overlay>
  );
}
