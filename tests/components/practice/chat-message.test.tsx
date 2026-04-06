import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ChatMessage } from "@/components/practice/chat-message";

describe("ChatMessage", () => {
  it("renders user message content", () => {
    render(<ChatMessage role="user" content="我想做一个 AI 写作助手" />);
    expect(screen.getByText("我想做一个 AI 写作助手")).toBeInTheDocument();
  });

  it("renders assistant message content", () => {
    render(<ChatMessage role="assistant" content="好的，让我帮你分析这个方向。" />);
    expect(screen.getByText("好的，让我帮你分析这个方向。")).toBeInTheDocument();
  });

  it("shows user label for user messages", () => {
    render(<ChatMessage role="user" content="test" />);
    expect(screen.getByText("你")).toBeInTheDocument();
  });

  it("shows AI label for assistant messages", () => {
    render(<ChatMessage role="assistant" content="test" />);
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("applies different alignment for user vs assistant", () => {
    const { container: userContainer } = render(
      <ChatMessage role="user" content="user msg" />
    );
    const userWrapper = userContainer.firstChild as HTMLElement;
    expect(userWrapper.className).toContain("justify-end");

    const { container: aiContainer } = render(
      <ChatMessage role="assistant" content="ai msg" />
    );
    const aiWrapper = aiContainer.firstChild as HTMLElement;
    expect(aiWrapper.className).toContain("justify-start");
  });
});
