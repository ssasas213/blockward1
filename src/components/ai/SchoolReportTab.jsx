import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { BarChart3, Download, Loader2, AlertCircle, FileText, TrendingUp, AlertTriangle, Lightbulb, Trophy, Users } from 'lucide-react';
import jsPDF from 'jspdf';

export default function SchoolReportTab({ userType, schoolId }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await base44.functions.invoke('schoolInsightsReport', {});
      const data = res.data;
      if (!data?.ok) {
        setError(data?.message || 'Failed to generate report.');
        return;
      }
      setReport(data);
    } catch (e) {
      setError(e?.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!report) return;
    const { stats, narrative } = report;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 18;

    // Title
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text('BlockWard School Insights Report', margin, y);
    y += 8;
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(stats.school_name || 'Your School', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.text(`Generated ${new Date(stats.generated_at).toLocaleString()}`, margin, y);
    y += 8;

    // Executive summary
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text('Executive Summary', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const summary = doc.splitTextToSize(narrative?.executive_summary || 'No summary available.', pageW - margin * 2);
    doc.text(summary, margin, y);
    y += summary.length * 5 + 4;

    // Key totals
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text('Key Totals', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const t = stats.totals;
    const totalsLines = [
      `Students: ${t.students}    Teachers: ${t.teachers}    Classes: ${t.classes}`,
      `Achievement records: ${t.achievement_records}    BlockWards minted: ${t.blockwards_minted}`,
      `Achievement points: ${t.achievement_points}    Behaviour points: ${t.behaviour_points}`,
      `Behaviour-to-achievement ratio: ${t.behaviour_to_achievement_ratio}`,
    ];
    totalsLines.forEach(line => { doc.text(line, margin, y); y += 5; });
    y += 3;

    // Records by status
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text('Records by Status', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    Object.entries(stats.records_by_status).forEach(([k, v]) => { doc.text(`${k}: ${v}`, margin, y); y += 5; });
    y += 3;

    // Records by category
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text('Records by Category', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    Object.entries(stats.records_by_category).forEach(([k, v]) => { doc.text(`${k}: ${v}`, margin, y); y += 5; });
    y += 3;

    // Top performers
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text('Top Performers', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    stats.top_performers.forEach((p, i) => { doc.text(`${i + 1}. ${p.name} - ${p.points} pts`, margin, y); y += 5; });
    y += 3;

    const block = (title, items, color) => {
      if (!items?.length) return;
      if (y > 250) { doc.addPage(); y = 18; }
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text(title, margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(color);
      items.forEach(item => {
        const lines = doc.splitTextToSize(`• ${item}`, pageW - margin * 2);
        doc.text(lines, margin, y);
        y += lines.length * 5;
      });
      y += 3;
    };

    block('Highlights', narrative?.highlights, [21, 128, 61]);
    block('Concerns', narrative?.concerns, [185, 28, 28]);
    block('Recommendations', narrative?.recommendations, [124, 58, 237]);

    if (narrative?.category_insight) {
      if (y > 250) { doc.addPage(); y = 18; }
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text('Category Insight', margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const ci = doc.splitTextToSize(narrative.category_insight, pageW - margin * 2);
      doc.text(ci, margin, y);
    }

    doc.save(`BlockWard-Report-${(stats.school_name || 'school').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          School-wide Insights Report
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          AI analyses your whole school's achievements, points, and trends — then writes a report you can download.
        </p>
      </div>

      <Button onClick={generate} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
        {loading ? 'Analysing school data…' : report ? 'Regenerate Report' : 'Generate School Report'}
      </Button>

      {error && (
        <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-5 animate-fade-in">
          {/* Download */}
          <div className="flex justify-end">
            <Button onClick={downloadPdf} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>

          {/* Executive summary */}
          {report.narrative?.executive_summary && (
            <div className="p-4 rounded-xl border border-border bg-secondary/40">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Executive Summary</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{report.narrative.executive_summary}</p>
            </div>
          )}

          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Users} label="Students" value={report.stats.totals.students} />
            <StatCard icon={Trophy} label="Achievements" value={report.stats.totals.achievement_records} />
            <StatCard icon={TrendingUp} label="Ach. Points" value={report.stats.totals.achievement_points} />
            <StatCard icon={AlertTriangle} label="Beh. Points" value={report.stats.totals.behaviour_points} />
          </div>

          {/* Highlights */}
          {report.narrative?.highlights?.length > 0 && (
            <InsightList title="Highlights" items={report.narrative.highlights} icon={TrendingUp} color="text-success" />
          )}

          {/* Concerns */}
          {report.narrative?.concerns?.length > 0 && (
            <InsightList title="Concerns" items={report.narrative.concerns} icon={AlertTriangle} color="text-destructive" />
          )}

          {/* Recommendations */}
          {report.narrative?.recommendations?.length > 0 && (
            <InsightList title="Recommendations" items={report.narrative.recommendations} icon={Lightbulb} color="text-primary" />
          )}

          {/* Category insight */}
          {report.narrative?.category_insight && (
            <div className="p-4 rounded-xl border border-border bg-secondary/40">
              <h3 className="text-sm font-semibold text-foreground mb-2">Category Insight</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{report.narrative.category_insight}</p>
            </div>
          )}

          {/* Top performers */}
          {report.stats.top_performers?.length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-secondary/40">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Top Performers</h3>
              </div>
              <ol className="space-y-2">
                {report.stats.top_performers.map((p, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      <span className="text-muted-foreground mr-2">{i + 1}.</span>{p.name}
                    </span>
                    <span className="font-medium text-primary">{p.points} pts</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="p-3 rounded-xl border border-border bg-card">
      <Icon className="h-4 w-4 text-muted-foreground mb-2" />
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function InsightList({ title, items, icon: Icon, color }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-secondary/40">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className={`${color} mt-0.5`}>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}