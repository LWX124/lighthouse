"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";

// Dynamically import to avoid SSR issues
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface TutorialEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TutorialEditor({ value, onChange }: TutorialEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === "string") {
        onChange(content);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {/* File upload */}
      <div>
        <label
          htmlFor="md-file-upload"
          className="cursor-pointer rounded border px-3 py-1.5 text-sm hover:bg-accent"
        >
          上传 .md 文件
        </label>
        <input
          id="md-file-upload"
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown"
          onChange={handleFileUpload}
          className="sr-only"
          aria-label="上传 .md 文件"
        />
      </div>

      {/* Editor */}
      <div data-color-mode="dark">
        <MDEditor
          value={value}
          onChange={(v) => onChange(v ?? "")}
          height={500}
          preview="live"
        />
      </div>
    </div>
  );
}
