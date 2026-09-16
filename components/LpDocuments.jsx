"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * LP-facing documents view. Lists the caller's own files (server enforces
 * this via session, so we don't pass a username) with a download button
 * per row. No upload — LPs can only download what an admin uploaded for
 * them.
 */
export default function LpDocuments({ userName }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError('');
      try {
        const res = await fetch('/api/documents');
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed to load documents');
        if (!cancelled) setDocs(j.docs || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const fmtSize = n => n < 1024 ? `${n} B`
    : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
  const fmtDate = iso => iso ? new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Your Documents</h1>
        <p className="text-sm text-muted-foreground">
          Files your fund admin has shared with you — K-1 forms, statements, agreements. Click any file to download.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {userName ? `${userName}'s folder` : 'Your folder'}
            {!loading && <span className="ml-2 text-xs font-normal text-muted-foreground">({docs.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading your documents…</p>}
          {!loading && error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && docs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No documents shared with you yet.</p>
              <p className="text-xs mt-2">When your fund admin uploads a K-1 or other document, it will appear here and you&apos;ll get an email.</p>
            </div>
          )}
          {!loading && !error && docs.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Filename</th>
                    <th className="text-right px-3 py-2">Size</th>
                    <th className="text-right px-3 py-2">Uploaded</th>
                    <th className="text-right px-3 py-2 w-24">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map(d => (
                    <tr key={d.key} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium truncate">{d.filename}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtSize(d.size)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground text-xs">{fmtDate(d.uploadedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <a href={`/api/documents/download?key=${encodeURIComponent(d.key)}`}
                           className="inline-block text-xs px-3 py-1.5 rounded border font-medium hover:bg-primary hover:text-primary-foreground transition-colors">
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        Documents are encrypted at rest and served over HTTPS. Only you and your fund admin can access this folder.
      </p>
    </div>
  );
}
