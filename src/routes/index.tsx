import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import {
  Search,
  Download,
  FileJson,
  FileText,
  Share2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  History,
  Sparkles,
  Globe,
  Trash2,
} from "lucide-react";
import { analyzeUrl, aiRecommendations, type SeoReport, type Check } from "@/lib/seo.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI SEO Analyzer — Full Site Audit & Recommendations" },
      {
        name: "description",
        content:
          "Analyze any URL for SEO, performance, accessibility, and security. Get an AI-powered audit with prioritized fixes, code examples, and exports.",
      },
      { property: "og:title", content: "AI SEO Analyzer — Full Site Audit & Recommendations" },
      { property: "og:description", content: "Analyze any URL for SEO, performance, accessibility, and security. Get an AI-powered audit with prioritized fixes, code examples, and exports." },
    ],
  }),
  component: Index,
});

const HISTORY_KEY = "seo_history_v1";

type HistoryItem = { url: string; score: number; at: string; report: SeoReport };

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function scoreColor(score: number) {
  if (score >= 90) return "var(--success)";
  if (score >= 75) return "var(--chart-2)";
  if (score >= 50) return "var(--warning)";
  return "var(--danger)";
}

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Poor";
}

function Index() {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<SeoReport | null>(null);
  const [aiText, setAiText] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>("overview");

  const analyzeFn = useServerFn(analyzeUrl);
  const aiFn = useServerFn(aiRecommendations);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const analyze = useMutation({
    mutationFn: (u: string) => analyzeFn({ data: { url: u } }),
    onSuccess: (r) => {
      setReport(r);
      setAiText("");
      setActiveTab("overview");
      const item: HistoryItem = { url: r.url, score: r.scores.overall, at: r.fetchedAt, report: r };
      const next = [item, ...loadHistory().filter((h) => h.url !== r.url)].slice(0, 20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      setHistory(next);
    },
  });

  const ai = useMutation({
    mutationFn: () => {
      if (!report) throw new Error("no report");
      return aiFn({
        data: {
          url: report.url,
          scores: report.scores,
          issues: report.recommendations.map((r) => ({
            name: r.name,
            category: r.category,
            status: r.status,
            severity: r.severity,
            value: (r.value ?? null) as string | number | null,
          })),
        },
      });
    },
    onSuccess: (r) => setAiText(r.content),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    analyze.mutate(url);
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const downloadJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seo-${new URL(report.url).host}.json`;
    a.click();
  };

  const downloadCSV = () => {
    if (!report) return;
    const rows = [["category", "name", "status", "severity", "value", "why", "fix"]];
    for (const c of report.recommendations.concat(
      Object.values(report.categories).flat().filter((c) => c.status === "pass")
    )) {
      rows.push([
        c.category,
        c.name,
        c.status,
        c.severity,
        String(c.value ?? ""),
        c.why.replace(/\n/g, " "),
        c.fix.replace(/\n/g, " "),
      ]);
    }
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seo-${new URL(report.url).host}.csv`;
    a.click();
  };

  const printReport = () => {
    window.print();
  };

  const share = async () => {
    if (!report) return;
    const text = `SEO score for ${report.url}: ${report.scores.overall}/100`;
    if (navigator.share) await navigator.share({ title: "SEO Report", text, url: report.url });
    else {
      await navigator.clipboard.writeText(text);
      alert("Summary copied to clipboard");
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-30 bg-background/60">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), var(--accent))",
              }}
            >
              <Sparkles className="w-5 h-5 text-background" />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">SEO Analyzer</div>
              <div className="text-xs text-muted-foreground">AI-powered full site audit</div>
            </div>
          </div>
          <a
            href="https://lovable.dev"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Built on Lovable
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!report && (
          <section className="text-center py-14">
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{ background: "oklch(0.72 0.18 155 / 0.15)", color: "var(--primary)" }}
            >
              Free • No signup • Full audit in seconds
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto">
              Audit any website like{" "}
              <span
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary), var(--accent))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Lighthouse & Ahrefs
              </span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Enter a URL and get an instant SEO, performance, accessibility, and security
              report with prioritized fixes and AI-generated recommendations.
            </p>
          </section>
        )}

        <form onSubmit={onSubmit} className="max-w-3xl mx-auto flex gap-2 mb-8">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={analyze.isPending}
            className="px-6 py-3 rounded-xl font-medium text-primary-foreground disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-transform hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--accent))",
            }}
          >
            {analyze.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {analyze.isPending ? "Analyzing…" : "Analyze"}
          </button>
        </form>

        {analyze.isError && (
          <div className="max-w-3xl mx-auto p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-6">
            {(analyze.error as Error).message}
          </div>
        )}

        {!report && history.length > 0 && (
          <section className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <History className="w-4 h-4" /> Recent analyses
              </div>
              <button
                onClick={clearHistory}
                className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>
            <div className="space-y-2">
              {history.map((h) => (
                <button
                  key={h.at}
                  onClick={() => setReport(h.report)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition text-left"
                >
                  <div className="truncate">
                    <div className="font-medium truncate">{h.url}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.at).toLocaleString()}
                    </div>
                  </div>
                  <ScorePill score={h.score} />
                </button>
              ))}
            </div>
          </section>
        )}

        {report && (
          <ReportView
            report={report}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onReset={() => setReport(null)}
            onDownloadJSON={downloadJSON}
            onDownloadCSV={downloadCSV}
            onPrint={printReport}
            onShare={share}
            onAi={() => ai.mutate()}
            aiText={aiText}
            aiLoading={ai.isPending}
            aiError={ai.error as Error | null}
          />
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-8 text-xs text-muted-foreground text-center">
        SEO Analyzer • Results are diagnostic and do not guarantee search rankings.
      </footer>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <div
      className="px-3 py-1 rounded-full font-semibold text-sm"
      style={{ background: `${scoreColor(score)}22`, color: scoreColor(score) }}
    >
      {score}
    </div>
  );
}

function ScoreRing({ score, label, size = 120 }: { score: number; label: string; size?: number }) {
  const data = [{ name: label, value: score, fill: scoreColor(score) }];
  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size }} className="relative">
        <ResponsiveContainer>
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "oklch(0.24 0.02 265)" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold" style={{ color: scoreColor(score) }}>
            {score}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">/100</div>
        </div>
      </div>
      <div className="text-sm mt-2 font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{scoreLabel(score)}</div>
    </div>
  );
}

const TABS = [
  "overview",
  "basic",
  "headings",
  "images",
  "links",
  "social",
  "performance",
  "security",
  "accessibility",
  "content",
  "recommendations",
  "ai",
] as const;

function ReportView({
  report,
  activeTab,
  setActiveTab,
  onReset,
  onDownloadJSON,
  onDownloadCSV,
  onPrint,
  onShare,
  onAi,
  aiText,
  aiLoading,
  aiError,
}: {
  report: SeoReport;
  activeTab: string;
  setActiveTab: (t: string) => void;
  onReset: () => void;
  onDownloadJSON: () => void;
  onDownloadCSV: () => void;
  onPrint: () => void;
  onShare: () => void;
  onAi: () => void;
  aiText: string;
  aiLoading: boolean;
  aiError: Error | null;
}) {
  const sev = useMemo(() => {
    const s = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const r of report.recommendations) {
      if (r.severity in s) (s as Record<string, number>)[r.severity]++;
    }
    return s;
  }, [report]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top summary */}
      <div className="p-6 rounded-2xl bg-card border border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Report for
            </div>
            <div className="text-xl font-bold truncate">{report.url}</div>
            <div className="text-xs text-muted-foreground mt-1">
              HTTP {report.statusCode} • {report.responseTimeMs} ms •{" "}
              {new Date(report.fetchedAt).toLocaleString()}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onAi}
              disabled={aiLoading}
              className="px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 text-primary-foreground"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              AI Suggestions
            </button>
            <ToolbarBtn onClick={onDownloadJSON} icon={<FileJson className="w-4 h-4" />}>
              JSON
            </ToolbarBtn>
            <ToolbarBtn onClick={onDownloadCSV} icon={<FileText className="w-4 h-4" />}>
              CSV
            </ToolbarBtn>
            <ToolbarBtn onClick={onPrint} icon={<Download className="w-4 h-4" />}>
              PDF
            </ToolbarBtn>
            <ToolbarBtn onClick={onShare} icon={<Share2 className="w-4 h-4" />}>
              Share
            </ToolbarBtn>
            <ToolbarBtn onClick={onReset} icon={<Search className="w-4 h-4" />}>
              New
            </ToolbarBtn>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <ScoreRing score={report.scores.overall} label="Overall" size={140} />
          <ScoreRing score={report.scores.seo} label="SEO" />
          <ScoreRing score={report.scores.performance} label="Performance" />
          <ScoreRing score={report.scores.accessibility} label="Accessibility" />
          <ScoreRing score={report.scores.bestPractices} label="Best Practices" />
          <ScoreRing score={report.scores.security} label="Security" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <StatCard label="Critical" value={sev.critical} color="var(--danger)" />
          <StatCard label="High" value={sev.high} color="var(--warning)" />
          <StatCard label="Medium" value={sev.medium} color="var(--chart-2)" />
          <StatCard label="Low" value={sev.low} color="var(--muted-foreground)" />
        </div>
      </div>

      {/* Screenshot + quick stats */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-medium">
            Screenshot
          </div>
          <img
            src={report.screenshotUrl}
            alt="Website screenshot"
            className="w-full aspect-[4/3] object-cover object-top bg-secondary"
            loading="lazy"
          />
        </div>
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="text-sm font-medium">Content</div>
          <MiniStat label="Word count" value={report.content.wordCount} />
          <MiniStat label="Reading time" value={`${report.content.readingTimeMin} min`} />
          <MiniStat label="DOM nodes" value={report.performance.domNodes} />
          <MiniStat label="HTML size" value={`${report.performance.htmlSizeKb} KB`} />
          <MiniStat label="Requests" value={report.performance.totalRequests} />
          <MiniStat label="Links" value={report.links.total} />
          <MiniStat label="Images" value={report.images.total} />
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl bg-card border border-border">
        <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 sticky top-16 bg-card/95 backdrop-blur z-20 rounded-t-2xl">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize whitespace-nowrap transition ${
                activeTab === t
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {t === "ai" ? "AI" : t}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          {activeTab === "overview" && <OverviewTab report={report} />}
          {activeTab === "basic" && <ChecksList checks={report.categories["Basic SEO"] || []} />}
          {activeTab === "headings" && <HeadingsTab report={report} />}
          {activeTab === "images" && <ImagesTab report={report} />}
          {activeTab === "links" && <LinksTab report={report} />}
          {activeTab === "social" && <SocialTab report={report} />}
          {activeTab === "performance" && <PerformanceTab report={report} />}
          {activeTab === "security" && (
            <ChecksList checks={report.categories["Security"] || []} />
          )}
          {activeTab === "accessibility" && (
            <ChecksList
              checks={[
                ...(report.categories["Accessibility"] || []),
                ...(report.categories["Mobile"] || []),
              ]}
            />
          )}
          {activeTab === "content" && <ContentTab report={report} />}
          {activeTab === "recommendations" && <RecommendationsTab report={report} />}
          {activeTab === "ai" && (
            <AiTab text={aiText} loading={aiLoading} error={aiError} onGenerate={onAi} />
          )}
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-lg text-sm font-medium bg-secondary hover:bg-muted inline-flex items-center gap-2 border border-border"
    >
      {icon}
      {children}
    </button>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-3 rounded-xl border border-border bg-background/40">
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: Check["status"] }) {
  if (status === "pass") return <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />;
  if (status === "warning") return <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />;
  return <XCircle className="w-4 h-4 text-[var(--danger)]" />;
}

function SeverityBadge({ severity }: { severity: Check["severity"] }) {
  const colors: Record<string, string> = {
    critical: "var(--danger)",
    high: "var(--warning)",
    medium: "var(--chart-2)",
    low: "var(--muted-foreground)",
    info: "var(--muted-foreground)",
  };
  return (
    <span
      className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${colors[severity]}22`, color: colors[severity] }}
    >
      {severity}
    </span>
  );
}

function ChecksList({ checks }: { checks: Check[] }) {
  if (checks.length === 0)
    return <div className="text-sm text-muted-foreground">No data.</div>;
  return (
    <div className="space-y-3">
      {checks.map((c) => (
        <div
          key={c.id}
          className="p-4 rounded-xl border border-border bg-background/40 hover:border-border transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <StatusIcon status={c.status} />
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {c.name} <SeverityBadge severity={c.severity} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 break-words">
                  Current: <span className="font-mono">{String(c.value ?? "—")}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                Why it matters
              </div>
              <p>{c.why}</p>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                How to fix
              </div>
              <p>{c.fix}</p>
            </div>
          </div>
          {c.example && (
            <pre className="mt-3 text-xs bg-background/80 border border-border rounded-lg p-3 overflow-x-auto">
              <code>{c.example}</code>
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function OverviewTab({ report }: { report: SeoReport }) {
  const passCount = Object.values(report.categories)
    .flat()
    .filter((c) => c.status === "pass").length;
  const warnCount = Object.values(report.categories)
    .flat()
    .filter((c) => c.status === "warning").length;
  const failCount = Object.values(report.categories)
    .flat()
    .filter((c) => c.status === "fail").length;

  const pie = [
    { name: "Pass", value: passCount, fill: "var(--success)" },
    { name: "Warning", value: warnCount, fill: "var(--warning)" },
    { name: "Fail", value: failCount, fill: "var(--danger)" },
  ];

  const scoreData = Object.entries(report.scores)
    .filter(([k]) => k !== "overall")
    .map(([k, v]) => ({ name: k, value: v, fill: scoreColor(v) }));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div>
        <div className="text-sm font-medium mb-3">Checks summary</div>
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pie} innerRadius={60} outerRadius={100} dataKey="value" label>
                {pie.map((_, i) => (
                  <Cell key={i} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 text-xs">
          {pie.map((p) => (
            <div key={p.name} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: p.fill }}
              />
              {p.name} ({p.value})
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm font-medium mb-3">Category scores</div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={scoreData} layout="vertical" margin={{ left: 24 }}>
              <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="var(--muted-foreground)"
                fontSize={11}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {scoreData.map((_, i) => (
                  <Cell key={i} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function HeadingsTab({ report }: { report: SeoReport }) {
  const data = Object.entries(report.headingCounts).map(([k, v]) => ({ name: k.toUpperCase(), count: v }));
  return (
    <div className="space-y-4">
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            />
            <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChecksList checks={report.categories["Headings"] || []} />
      <div className="rounded-xl border border-border p-4">
        <div className="text-sm font-medium mb-2">Heading list</div>
        <div className="space-y-1 max-h-80 overflow-y-auto text-sm">
          {report.headings.map((h, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: "var(--muted)", color: "var(--primary)" }}
              >
                H{h.level}
              </span>
              <span className="text-muted-foreground truncate">{h.text || <em>(empty)</em>}</span>
            </div>
          ))}
          {report.headings.length === 0 && (
            <div className="text-muted-foreground">No headings found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImagesTab({ report }: { report: SeoReport }) {
  const { images } = report;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={images.total} color="var(--foreground)" />
        <StatCard label="With ALT" value={images.withAlt} color="var(--success)" />
        <StatCard label="Missing ALT" value={images.missingAlt} color="var(--danger)" />
        <StatCard label="Lazy loaded" value={images.lazy} color="var(--chart-2)" />
        <StatCard label="WebP/AVIF" value={images.modernFormat} color="var(--chart-2)" />
      </div>
      <ChecksList checks={report.categories["Images"] || []} />
      <div className="rounded-xl border border-border p-4">
        <div className="text-sm font-medium mb-2">Sample images</div>
        <div className="space-y-2 text-sm">
          {images.samples.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
              <span className="truncate font-mono text-xs">{s.src}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {s.alt ? `alt: ${s.alt.slice(0, 40)}` : "no alt"} · {s.loading || "eager"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LinksTab({ report }: { report: SeoReport }) {
  const { links } = report;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={links.total} color="var(--foreground)" />
        <StatCard label="Internal" value={links.internal} color="var(--primary)" />
        <StatCard label="External" value={links.external} color="var(--chart-2)" />
        <StatCard label="Mailto" value={links.mailto} color="var(--muted-foreground)" />
        <StatCard label="Nofollow" value={links.nofollow} color="var(--warning)" />
      </div>
      <ChecksList checks={report.categories["Links"] || []} />
      <div className="rounded-xl border border-border p-4">
        <div className="text-sm font-medium mb-2">Sample links</div>
        <div className="space-y-1 text-sm max-h-80 overflow-y-auto">
          {links.samples.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1">
              <span className="truncate">{s.text || <em className="text-muted-foreground">(no text)</em>}</span>
              <span className="text-xs font-mono text-muted-foreground truncate max-w-xs">{s.href}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{s.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SocialTab({ report }: { report: SeoReport }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold mb-2">Social preview</div>
        <div className="max-w-md rounded-xl border border-border overflow-hidden bg-background">
          {report.openGraph.image ? (
            <img src={report.openGraph.image} alt="OG" className="w-full aspect-[1.9/1] object-cover" />
          ) : (
            <div className="aspect-[1.9/1] flex items-center justify-center text-xs text-muted-foreground bg-muted">
              No og:image
            </div>
          )}
          <div className="p-3">
            <div className="text-[11px] uppercase text-muted-foreground truncate">
              {new URL(report.url).host}
            </div>
            <div className="font-semibold text-sm">
              {report.openGraph.title || report.meta.title || "No title"}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {report.openGraph.description || report.meta.description || "No description"}
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold mb-2">Open Graph</div>
        <ChecksList checks={report.categories["Open Graph"] || []} />
      </div>
      <div>
        <div className="text-sm font-semibold mb-2">Twitter Cards</div>
        <ChecksList checks={report.categories["Twitter"] || []} />
      </div>
    </div>
  );
}

function PerformanceTab({ report }: { report: SeoReport }) {
  const data = [
    { name: "HTML", value: report.performance.htmlSizeKb },
    { name: "CSS req", value: report.performance.cssRequests },
    { name: "JS req", value: report.performance.jsRequests },
    { name: "Images", value: report.performance.imageRequests },
    { name: "DOM/100", value: Math.round(report.performance.domNodes / 100) },
  ];
  return (
    <div className="space-y-4">
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            />
            <Bar dataKey="value" fill="var(--accent)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChecksList checks={report.categories["Performance"] || []} />
    </div>
  );
}

function ContentTab({ report }: { report: SeoReport }) {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <StatCard label="Words" value={report.content.wordCount} color="var(--foreground)" />
        <StatCard label="Reading min" value={report.content.readingTimeMin} color="var(--chart-2)" />
        <StatCard label="Unique keywords" value={report.content.topKeywords.length} color="var(--primary)" />
      </div>
      <ChecksList checks={report.categories["Content"] || []} />
      <div className="rounded-xl border border-border p-4">
        <div className="text-sm font-medium mb-3">Top keywords</div>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          {report.content.topKeywords.map((k) => (
            <div
              key={k.word}
              className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2 bg-background/40"
            >
              <span className="font-medium">{k.word}</span>
              <span className="text-xs text-muted-foreground">
                {k.count} · {k.density}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecommendationsTab({ report }: { report: SeoReport }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        {report.recommendations.length} issues sorted by severity.
      </div>
      <ChecksList checks={report.recommendations} />
    </div>
  );
}

function AiTab({
  text,
  loading,
  error,
  onGenerate,
}: {
  text: string;
  loading: boolean;
  error: Error | null;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> AI Recommendations
          </div>
          <div className="text-xs text-muted-foreground">
            Personalized fixes generated from your audit.
          </div>
        </div>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="px-3 py-2 rounded-lg text-sm font-medium text-primary-foreground inline-flex items-center gap-2"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {text ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error.message}
        </div>
      )}
      {!text && !loading && !error && (
        <div className="text-sm text-muted-foreground p-6 border border-dashed border-border rounded-xl text-center">
          Click Generate to get AI-powered recommendations tailored to your report.
        </div>
      )}
      {text && (
        <div className="prose-invert p-4 bg-background/40 border border-border rounded-xl text-sm whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}
