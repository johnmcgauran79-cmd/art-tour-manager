import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag, Printer, Download, ArrowLeft } from "lucide-react";
import { useTours } from "@/hooks/useTours";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface NameTagGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TourNames {
  tourId: string;
  tourName: string;
  startDate: string;
  names: string[];
}

const upper = (s: string | null | undefined) => (s || "").trim().toUpperCase();

export const NameTagGeneratorModal = ({ open, onOpenChange }: NameTagGeneratorModalProps) => {
  const { data: tours = [] } = useTours();
  const [selectedTourIds, setSelectedTourIds] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);
  // Host bookings use status = 'host'. They're included by default, but a
  // host doing multiple tours may not need a name tag for every tour, so this
  // toggle lets staff exclude them.
  const [includeHost, setIncludeHost] = useState(true);

  const sortedTours = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...tours]
      .filter(t =>
        t.status !== 'cancelled' &&
        t.status !== 'past' &&
        (t.end_date || t.start_date || '') >= today
      )
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  }, [tours]);

  const toggleTour = (id: string) => {
    setSelectedTourIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const { data: report, isLoading } = useQuery({
    queryKey: ['name-tag-report', selectedTourIds, includeHost],
    enabled: showReport && selectedTourIds.length > 0,
    queryFn: async (): Promise<TourNames[]> => {
      // Host bookings use status = 'host'. Excluded when the toggle is off.
      const excluded = includeHost
        ? '(cancelled,waitlisted)'
        : '(cancelled,waitlisted,host)';
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, tour_id, status, passenger_count,
          tours!inner (id, name, start_date),
          customers:customers!lead_passenger_id (first_name, preferred_name),
          passenger_2:customers!passenger_2_id (first_name, preferred_name),
          passenger_3:customers!passenger_3_id (first_name, preferred_name)
        `)
        .in('tour_id', selectedTourIds)
        // Waitlisted bookings aren't confirmed travellers, so they must not
        // produce name tags (Everest was showing 50 names for 46 travelling).
        .not('status', 'in', excluded);

      if (error) throw error;

      const grouped = new Map<string, TourNames>();
      for (const tid of selectedTourIds) {
        const t = tours.find(tt => tt.id === tid);
        if (t) grouped.set(tid, { tourId: tid, tourName: t.name, startDate: t.start_date, names: [] });
      }

      for (const b of (data || []) as any[]) {
        const bucket = grouped.get(b.tour_id);
        if (!bucket) continue;
        const addPerson = (first: string | null, preferred: string | null) => {
          const name = upper(preferred) || upper(first);
          if (name) bucket.names.push(name);
        };
        addPerson(b.customers?.first_name, b.customers?.preferred_name);
        addPerson(b.passenger_2?.first_name, b.passenger_2?.preferred_name);
        addPerson(b.passenger_3?.first_name, b.passenger_3?.preferred_name);
      }

      // Sort names alphabetically within each tour
      for (const v of grouped.values()) v.names.sort((a, b) => a.localeCompare(b));

      return Array.from(grouped.values()).sort((a, b) =>
        (a.startDate || '').localeCompare(b.startDate || '')
      );
    },
  });

  const handleExportCSV = () => {
    if (!report) return;
    const rows: string[] = ['Tour,First Name'];
    for (const t of report) {
      for (const n of t.names) {
        rows.push(`"${t.tourName.replace(/"/g, '""')}","${n.replace(/"/g, '""')}"`);
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `name-tags-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!report) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const sections = report.map(t => `
      <h2>${t.tourName} <span style="font-weight:normal;font-size:0.8em;color:#555">(${formatDateToDDMMYYYY(t.startDate)})</span></h2>
      <p style="color:#555;margin-top:-8px">${t.names.length} name${t.names.length === 1 ? '' : 's'}</p>
      <ul style="columns:3;-webkit-columns:3;-moz-columns:3;list-style:none;padding:0">
        ${t.names.map(n => `<li style="padding:4px 0;font-size:14px">${n}</li>`).join('')}
      </ul>
    `).join('<hr style="margin:24px 0"/>');
    w.document.write(`<!doctype html><html><head><title>Name Tag Generator</title>
      <style>body{font-family:Arial,sans-serif;margin:24px}h1{color:#1a365d;border-bottom:2px solid #1a365d;padding-bottom:8px}h2{color:#1a365d;margin-top:24px}</style>
      </head><body><h1>Name Tag Generator</h1>${sections}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const reset = () => {
    setShowReport(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setShowReport(false);
      setSelectedTourIds([]);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Name Tag Generator
          </DialogTitle>
          <DialogDescription>
            {showReport
              ? 'First names of all passengers (in capitals), grouped by tour. Preferred names used where set.'
              : 'Select one or more tours to generate a name list for printing name tags.'}
          </DialogDescription>
        </DialogHeader>

        {!showReport ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{selectedTourIds.length} selected</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={includeHost}
                    onCheckedChange={(v) => setIncludeHost(v === true)}
                  />
                  Include host name
                </label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTourIds(sortedTours.map(t => t.id))}>
                    Select all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTourIds([])}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 border rounded-md p-2">
              <div className="space-y-1">
                {sortedTours.map(t => (
                  <label
                    key={t.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedTourIds.includes(t.id)}
                      onCheckedChange={() => toggleTour(t.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateToDDMMYYYY(t.start_date)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                onClick={() => setShowReport(true)}
                disabled={selectedTourIds.length === 0}
              >
                Generate Report
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Change selection
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!report}>
                  <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} disabled={!report}>
                  <Printer className="h-4 w-4 mr-2" /> Print PDF
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 border rounded-md p-4">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              ) : !report || report.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No passengers found.</p>
              ) : (
                <div className="space-y-6">
                  {report.map(t => (
                    <div key={t.tourId}>
                      <h3 className="font-semibold text-brand-navy border-b pb-1 mb-2">
                        {t.tourName}{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                          ({formatDateToDDMMYYYY(t.startDate)}) — {t.names.length} name{t.names.length === 1 ? '' : 's'}
                        </span>
                      </h3>
                      {t.names.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No passengers.</p>
                      ) : (
                        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm font-mono">
                          {t.names.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};