import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";

// Mock next/dynamic to render components synchronously in tests
vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
    _opts?: unknown
  ) => {
    // Return a lazy component that React can render; we make it sync via use()
    const LazyComponent = React.lazy(loader);
    const Wrapper = (props: Record<string, unknown>) => (
      <React.Suspense fallback={null}>
        <LazyComponent {...props} />
      </React.Suspense>
    );
    return Wrapper;
  },
}));

// Mock @uiw/react-md-editor since it uses browser APIs
vi.mock("@uiw/react-md-editor", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="md-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { TutorialEditor } from "@/components/admin/tutorial-editor";

describe("TutorialEditor", () => {
  it("renders with initial value", async () => {
    render(
      <TutorialEditor value="# Hello" onChange={vi.fn()} />
    );
    expect(await screen.findByTestId("md-editor")).toHaveValue("# Hello");
  });

  it("calls onChange when editor content changes", async () => {
    const onChange = vi.fn();
    render(<TutorialEditor value="" onChange={onChange} />);
    fireEvent.change(await screen.findByTestId("md-editor"), {
      target: { value: "# New content" },
    });
    expect(onChange).toHaveBeenCalledWith("# New content");
  });

  it("renders file upload button", () => {
    render(<TutorialEditor value="" onChange={vi.fn()} />);
    expect(screen.getByText("上传 .md 文件")).toBeInTheDocument();
  });

  it("reads uploaded .md file and calls onChange", async () => {
    const onChange = vi.fn();
    render(<TutorialEditor value="" onChange={onChange} />);

    const fileInput = screen.getByLabelText("上传 .md 文件");
    const file = new File(["# Uploaded"], "test.md", { type: "text/markdown" });

    // Mock FileReader as a proper class constructor
    const mockReadAsText = vi.fn();
    const MockFileReaderClass = vi.fn().mockImplementation(function (this: {
      onload: ((e: ProgressEvent<FileReader>) => void) | null;
      result: string;
      readAsText: typeof mockReadAsText;
    }) {
      this.onload = null;
      this.result = "# Uploaded";
      this.readAsText = mockReadAsText;
    });

    vi.stubGlobal("FileReader", MockFileReaderClass);

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Get the instance that was created and trigger its onload
    const instance = MockFileReaderClass.mock.instances[0] as unknown as {
      onload: ((e: ProgressEvent<FileReader>) => void) | null;
      result: string;
    };
    instance.onload?.({ target: instance } as unknown as ProgressEvent<FileReader>);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("# Uploaded");
    });

    vi.unstubAllGlobals();
  });
});
