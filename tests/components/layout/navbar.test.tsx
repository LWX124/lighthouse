import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Navbar } from "@/components/layout/navbar";

describe("Navbar", () => {
  it("renders logo text", () => {
    render(<Navbar />);
    expect(screen.getByText("Lighthouse")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<Navbar />);
    expect(screen.getByText("教程")).toBeInTheDocument();
    expect(screen.getByText("AI工具榜")).toBeInTheDocument();
    expect(screen.getByText("AI新鲜事")).toBeInTheDocument();
    expect(screen.getByText("需求Hub")).toBeInTheDocument();
    expect(screen.getByText("AI实践")).toBeInTheDocument();
  });
});
