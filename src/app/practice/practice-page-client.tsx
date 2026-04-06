"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "@/components/practice/chat-message";
import { ChatInput } from "@/components/practice/chat-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Plan {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PracticePageClientProps {
  plans: Plan[];
  isPro: boolean;
}

export function PracticePageClient({
  plans: initialPlans,
  isPro,
}: PracticePageClientProps) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const createNewPlan = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/practice/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新方案" }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "创建方案失败");
      return;
    }

    const plan = await res.json();
    setPlans((prev) => [plan, ...prev]);
    setActivePlanId(plan.id);
    setMessages([]);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!activePlanId || isStreaming) return;

      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setIsStreaming(true);

      // Add placeholder for AI response
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/practice/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: activePlanId, message: text }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "请求失败");
          setMessages((prev) => prev.slice(0, -1));
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          setError("无法读取响应流");
          setIsStreaming(false);
          return;
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);

            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed.text,
                    };
                  }
                  return updated;
                });
              }
              if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      } catch {
        setError("网络错误，请重试");
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsStreaming(false);
      }
    },
    [activePlanId, isStreaming]
  );

  return (
    <div className="flex gap-6">
      {/* Sidebar — plan list */}
      <div className="w-64 shrink-0 space-y-3">
        <Button onClick={createNewPlan} className="w-full">
          + 新方案
        </Button>

        <div className="space-y-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => {
                setActivePlanId(plan.id);
                setMessages([]);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activePlanId === plan.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="truncate font-medium">{plan.title}</div>
              <div className="text-xs opacity-70">
                {new Date(plan.created_at).toLocaleDateString("zh-CN")}
              </div>
            </button>
          ))}
        </div>

        {!isPro && (
          <Card className="p-3 text-xs text-muted-foreground">
            免费版每日 1 次方案生成
          </Card>
        )}
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {activePlanId ? (
          <>
            <div
              ref={scrollRef}
              className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border bg-background p-4"
              style={{ minHeight: "400px", maxHeight: "60vh" }}
            >
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <p>输入你的想法，AI 将帮你生成落地方案 ✨</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <ChatMessage key={i} role={msg.role} content={msg.content} />
              ))}
            </div>

            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

            <div className="mt-4">
              <ChatInput onSend={handleSend} disabled={isStreaming} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">选择一个方案或创建新方案</p>
              <p className="mt-1 text-sm">点击左侧「+ 新方案」开始</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
