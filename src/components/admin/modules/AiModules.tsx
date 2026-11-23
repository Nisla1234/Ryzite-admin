import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ClipboardList, Lightbulb, Newspaper, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime } from "@/lib/format";
import {
  createAiTaskFn,
  deleteAiTaskFn,
  generateAiReportFn,
  getAiWorkspaceFn,
  saveCmsDocumentFn,
  updateAiTaskFn,
} from "@/lib/platform.functions";

export type AiSection = "daily-report" | "health" | "tasks" | "content";

const HEADERS: Record<AiSection, { title: string; description: string }> = {
  "daily-report": {
    title: "Daily AI Reports",
    description:
      "Daily diagnostic briefs grounded strictly in verified SEO, PageSpeed, and availability signals.",
  },
  health: {
    title: "Website Health Analysis",
    description:
      "Combined technical posture across HTTP availability, SEO crawl findings, PageSpeed, and enquiries.",
  },
  tasks: {
    title: "Priority Tasks",
    description:
      "Actionable remediation checklist linked to SEO, performance, and content improvements.",
  },
  content: {
    title: "AI Content Suggestions",
    description:
      "Editorial topic briefs saved only as drafts for human review — never published automatically.",
  },
};

export function AiModule({ view }: { view: AiSection }) {
  const qc = useQueryClient();
  const fetchAi = useServerFn(getAiWorkspaceFn);
  const genReportFn = useServerFn(generateAiReportFn);
  const createTaskFn = useServerFn(createAiTaskFn);
  const updateTaskFn = useServerFn(updateAiTaskFn);
  const delTaskFn = useServerFn(deleteAiTaskFn);
  const saveCmsFn = useServerFn(saveCmsDocumentFn);

  const [topic, setTopic] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"high" | "medium" | "low">("medium");

  const query = useQuery({
    queryKey: ["ai-workspace"],
    queryFn: () => fetchAi(),
  });

  const genMutation = useMutation({
    mutationFn: (reportType: "daily" | "health" | "content") =>
      genReportFn({
        data: { reportType, ...(reportType === "content" && topic ? { topic } : {}) },
      }),
    onSuccess: (res) => {
      toast.success(`Generated ${res.report.title}`);
      if (res.warning) toast.message(res.warning);
      void qc.invalidateQueries({ queryKey: ["ai-workspace"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Report generation failed"),
  });

  const createTaskMutation = useMutation({
    mutationFn: () =>
      createTaskFn({
        data: {
          title: newTaskTitle,
          description: newTaskDesc,
          priority: newTaskPriority,
          source: "ai",
        },
      }),
    onSuccess: () => {
      toast.success("Priority task created.");
      setNewTaskTitle("");
      setNewTaskDesc("");
      void qc.invalidateQueries({ queryKey: ["ai-workspace"] });
      void qc.invalidateQueries({ queryKey: ["executive-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create task"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: (p: { id: string; status: "open" | "in_progress" | "done" | "dismissed" }) =>
      updateTaskFn({ data: p }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ai-workspace"] });
      void qc.invalidateQueries({ queryKey: ["executive-overview"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => delTaskFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Task removed.");
      void qc.invalidateQueries({ queryKey: ["ai-workspace"] });
    },
  });

  const saveDraftArticleMutation = useMutation({
    mutationFn: (rep: { title: string; summary: string }) =>
      saveCmsFn({
        data: {
          doc_type: "article",
          slug: `draft-${Date.now().toString().slice(-6)}`,
          title: rep.title.replace(/^Content Brief:\s*/i, ""),
          summary: rep.summary.slice(0, 220),
          category: "Editorial Draft",
          status: "draft",
          payload: { author: "RYZITE Editorial", body: rep.summary, tags: "ai-draft" },
          seo: {},
          change_summary: "Created draft article from AI Content Suggestion",
        },
      }),
    onSuccess: (res) => {
      if (res.ok) toast.success("Saved as draft article in Website Management -> Articles.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save draft"),
  });

  const data = query.data;
  const hdr = HEADERS[view];
  const reportTypeFilter =
    view === "daily-report" ? "daily" : view === "health" ? "health" : "content";
  const matchingReports = (data?.reports ?? []).filter((r) => r.report_type === reportTypeFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Intelligence"
        title={hdr.title}
        description={hdr.description}
        actions={
          <Badge variant={data?.hasAiProvider ? "ai" : "muted"}>
            {data?.hasAiProvider
              ? "Generative AI key configured"
              : "Rule-based mode (add GEMINI_API_KEY or OPENAI_API_KEY)"}
          </Badge>
        }
      />

      {view === "tasks" ? (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Panel title="Add Priority Task">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (newTaskTitle.trim().length >= 3) createTaskMutation.mutate();
              }}
            >
              <div className="space-y-1">
                <Label>Task Title *</Label>
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g., Fix Astro MainLayout <title> tag"
                />
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select
                  value={newTaskPriority}
                  onValueChange={(v) => setNewTaskPriority(v as "high" | "medium" | "low")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Details</Label>
                <Textarea
                  rows={3}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={createTaskMutation.isPending || newTaskTitle.trim().length < 3}
              >
                <Plus className="size-4" /> Add task
              </Button>
            </form>
          </Panel>

          <Panel title={`Tracked Tasks (${data?.tasks.length ?? 0})`}>
            {!data?.tasks.length ? (
              <EmptyState
                icon={<ClipboardList />}
                title="No tasks yet"
                description="Create a remediation task or add one from PageSpeed or SEO issues."
              />
            ) : (
              <ul className="divide-y">
                {data.tasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            t.priority === "high"
                              ? "danger"
                              : t.priority === "medium"
                                ? "warning"
                                : "muted"
                          }
                        >
                          {t.priority}
                        </Badge>
                        <span
                          className={`font-semibold text-sm ${
                            t.status === "done" ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {t.title}
                        </span>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Select
                        value={t.status}
                        onValueChange={(v) =>
                          updateTaskMutation.mutate({
                            id: t.id,
                            status: v as "open" | "in_progress" | "done" | "dismissed",
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="dismissed">Dismissed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive"
                        aria-label="Delete task"
                        onClick={() => deleteTaskMutation.mutate(t.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : (
        <div className="space-y-6">
          <Panel
            title={
              view === "content"
                ? "Generate Content Brief"
                : view === "daily-report"
                  ? "Generate Daily Executive Report"
                  : "Run Website Health Analysis"
            }
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              {view === "content" && (
                <div className="flex-1 space-y-1">
                  <Label>Topic or Target Keyword Focus</Label>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., AI automation for Sri Lankan SMEs"
                  />
                </div>
              )}
              <Button
                disabled={genMutation.isPending}
                onClick={() => genMutation.mutate(reportTypeFilter)}
              >
                <Sparkles className="size-4" />
                {genMutation.isPending ? "Generating…" : "Generate grounded report"}
              </Button>
            </div>
          </Panel>

          {matchingReports.length === 0 ? (
            <Panel>
              <EmptyState
                icon={view === "content" ? <Lightbulb /> : <Newspaper />}
                title="No reports saved in this category yet"
                description="Generate a report above using live RYZITE Control Centre signals."
              />
            </Panel>
          ) : (
            <div className="space-y-4">
              {matchingReports.map((rep) => (
                <Panel
                  key={rep.id}
                  title={rep.title}
                  description={`${fmtDateTime(rep.created_at)} · ${rep.provider}`}
                  actions={
                    view === "content" ? (
                      <Button
                        size="sm"
                        variant="subtle"
                        disabled={saveDraftArticleMutation.isPending}
                        onClick={() => saveDraftArticleMutation.mutate(rep)}
                      >
                        <Check className="size-3.5" /> Save as draft article
                      </Button>
                    ) : undefined
                  }
                >
                  <p className="whitespace-pre-line text-sm leading-relaxed">{rep.summary}</p>
                </Panel>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
