'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Papa from 'papaparse';

interface SheetsImportProps {
  onImported: () => void;
}

export default function SheetsImport({ onImported }: SheetsImportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setResult(null);

    // Parse and preview
    Papa.parse(file, {
      header: false,
      preview: 5,
      complete: (results) => {
        setPreview(results.data as string[][]);
      },
    });
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/sheets/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: `Successfully imported ${data.count} carousel${data.count > 1 ? 's' : ''} from "${fileName}"`,
        });
        onImported();
      } else {
        setResult({
          success: false,
          message: data.error || 'Import failed',
        });
      }
    } catch (e) {
      setResult({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold text-white tracking-tight">Import from Google Sheets</h2>
        <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
          Export your Google Sheet as CSV and upload it here. Each topic becomes a carousel automatically.
        </p>
      </div>

      {/* Format guide */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
        <p className="text-[10px] text-white/30 tracking-widest uppercase">Required CSV Format</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/40 border-b border-white/5">
                <th className="text-left py-1.5 pr-4 font-medium">Topic</th>
                <th className="text-left py-1.5 pr-4 font-medium">Chapter</th>
                <th className="text-left py-1.5 pr-4 font-medium">Title</th>
                <th className="text-left py-1.5 pr-4 font-medium">Subtitle</th>
                <th className="text-left py-1.5 pr-4 font-medium">BulletPoints</th>
                <th className="text-left py-1.5 font-medium">EarningPotential</th>
              </tr>
            </thead>
            <tbody className="text-white/25">
              <tr className="border-b border-white/[0.03]">
                <td className="py-1.5 pr-4">AI Dropshipping</td>
                <td className="py-1.5 pr-4">1</td>
                <td className="py-1.5 pr-4">Find Your Niche</td>
                <td className="py-1.5 pr-4">Research Phase</td>
                <td className="py-1.5 pr-4">Use AI tools; Analyze trends; ...</td>
                <td className="py-1.5">$500-$2K/mo</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4">AI Dropshipping</td>
                <td className="py-1.5 pr-4">2</td>
                <td className="py-1.5 pr-4">Setup Store</td>
                <td className="py-1.5 pr-4">Build Phase</td>
                <td className="py-1.5 pr-4">Choose platform; Design brand; ...</td>
                <td className="py-1.5">$2K-$5K/mo</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-white/20 leading-relaxed">
          Separate bullet points with semicolons (;). Group rows by Topic to create multi-chapter carousels.
          Download your Google Sheet as CSV (File → Download → Comma Separated Values).
        </p>
      </div>

      {/* Upload zone */}
      <div className="space-y-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-white/10 hover:border-white/20 rounded-xl p-10 text-center cursor-pointer transition-all group"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <FileSpreadsheet className="w-10 h-10 text-white/15 mx-auto mb-3 group-hover:text-white/25 transition-colors" />
          <p className="text-sm text-white/40 group-hover:text-white/60 transition-colors">
            {fileName || 'Click to upload CSV file'}
          </p>
          <p className="text-[10px] text-white/20 mt-1">.csv files only</p>
        </div>

        {/* Preview */}
        {preview && (
          <div className="rounded-lg border border-white/5 overflow-hidden">
            <p className="text-[10px] text-white/30 tracking-widest uppercase px-3 pt-3 pb-1">Preview (first 5 rows)</p>
            <div className="overflow-x-auto max-h-40 overflow-y-auto">
              <table className="w-full text-[11px]">
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className={i === 0 ? 'border-b border-white/5 bg-white/[0.03]' : 'border-b border-white/[0.02]'}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-1.5 text-white/40 whitespace-nowrap max-w-[200px] truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={!fileName || isImporting}
          className="w-full h-11 bg-white text-black hover:bg-white/90 font-semibold text-sm tracking-wider"
        >
          {isImporting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import & Generate Carousels
            </span>
          )}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
          result.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {result.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {result.message}
        </div>
      )}
    </div>
  );
}