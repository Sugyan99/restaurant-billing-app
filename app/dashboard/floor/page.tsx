"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { showToast } from "@/components/Toast";

// ─── Types ───────────────────────────────────────────────────────────────────
type TableShape = "square" | "round";
type TableStatus = "FREE" | "OCCUPIED" | "RESERVED";
type FloorTable = {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  posX: number;
  posY: number;
  shape: TableShape;
  section: string;
  mergedWith: string | null;
  orders: { id: string; status: string; items: { quantity: number }[] }[];
};
type Reservation = {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  date: string;
  tableId: string | null;
  status: string;
  notes: string | null;
};
type WaitlistEntry = {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  estimatedWait: number | null;
  notes: string | null;
  status: string;
  tableId: string | null;
  createdAt: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────
const GRID = 90;
const CANVAS_W = 1800;
const CANVAS_H = 1000;
const SECTIONS = ["Main Hall", "Terrace", "Private", "Bar"];

const STATUS_CONFIG: Record<TableStatus, { bg: string; border: string; text: string; label: string; dot: string }> = {
  FREE:     { bg: "bg-emerald-500/20", border: "border-emerald-400", text: "text-emerald-300", label: "Free",     dot: "bg-emerald-400" },
  OCCUPIED: { bg: "bg-red-500/20",     border: "border-red-400",     text: "text-red-300",     label: "Occupied", dot: "bg-red-400" },
  RESERVED: { bg: "bg-amber-500/20",   border: "border-amber-400",   text: "text-amber-300",   label: "Reserved", dot: "bg-amber-400" },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FloorPage() {
  const [tables, setTables]           = useState<FloorTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlist, setWaitlist]       = useState<WaitlistEntry[]>([]);
  const [activeSection, setActiveSection] = useState("All");
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null);
  const [mode, setMode]               = useState<"view" | "drag" | "merge" | "transfer">("view");
  const [mergeSource, setMergeSource] = useState<FloorTable | null>(null);
  const [transferSource, setTransferSource] = useState<FloorTable | null>(null);
  const [sidePanel, setSidePanel]     = useState<"none" | "reservations" | "waitlist">("none");
  const [loading, setLoading]         = useState(true);
  // Modals
  const [showAddTable, setShowAddTable] = useState(false);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [showReservationForm, setShowReservationForm] = useState(false);
  // Drag state
  const dragging = useRef<{ tableId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [tablesRes, resRes, wlRes] = await Promise.all([
      fetch("/api/tables").then(r => r.json()),
      fetch("/api/reservations").then(r => r.json()),
      fetch("/api/waitlist").then(r => r.json()),
    ]);
    setTables(tablesRes.tables ?? []);
    setReservations(resRes.reservations ?? []);
    setWaitlist(wlRes.waitlist ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const visibleTables = tables.filter(t =>
    activeSection === "All" || t.section === activeSection
  );
  const stats = {
    total: tables.length,
    free: tables.filter(t => t.status === "FREE").length,
    occupied: tables.filter(t => t.status === "OCCUPIED").length,
    reserved: tables.filter(t => t.status === "RESERVED").length,
  };
  const occupancyPct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;

  // ── Drag handlers ─────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent, table: FloorTable) {
    if (mode !== "drag") return;
    e.preventDefault();
    dragging.current = { tableId: table.id, startX: e.clientX, startY: e.clientY, origX: table.posX, origY: table.posY };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current || mode !== "drag") return;
    const dx = e.clientX - dragging.current.startX;
    const dy = e.clientY - dragging.current.startY;
    const newX = Math.max(0, Math.min(CANVAS_W - GRID, dragging.current.origX + dx));
    const newY = Math.max(0, Math.min(CANVAS_H - GRID, dragging.current.origY + dy));
    setTables(prev => prev.map(t =>
      t.id === dragging.current!.tableId ? { ...t, posX: newX, posY: newY } : t
    ));
  }

  async function onMouseUp() {
    if (!dragging.current || mode !== "drag") return;
    const { tableId } = dragging.current;
    dragging.current = null;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    // Snap to grid
    const snapX = Math.round(table.posX / GRID) * GRID;
    const snapY = Math.round(table.posY / GRID) * GRID;
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, posX: snapX, posY: snapY } : t));
    await fetch(`/api/tables/${tableId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posX: snapX, posY: snapY }),
    });
  }

  // ── Table click handler ───────────────────────────────────────────────────
  function onTableClick(table: FloorTable) {
    if (mode === "drag") return;
    if (mode === "merge") {
      if (!mergeSource) { setMergeSource(table); return; }
      if (mergeSource.id === table.id) { setMergeSource(null); return; }
      doMerge(mergeSource, table);
      return;
    }
    if (mode === "transfer") {
      if (!transferSource) {
        if (table.status !== "OCCUPIED") { showToast("Select an occupied table first", "error"); return; }
        setTransferSource(table); return;
      }
      if (transferSource.id === table.id) { setTransferSource(null); return; }
      doTransfer(transferSource, table);
      return;
    }
    setSelectedTable(prev => prev?.id === table.id ? null : table);
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function doMerge(primary: FloorTable, secondary: FloorTable) {
    const res = await fetch("/api/tables/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryTableId: primary.id, secondaryTableId: secondary.id }),
    });
    if (res.ok) { showToast(`Table ${secondary.number} merged with ${primary.number}`, "success"); setMergeSource(null); setMode("view"); load(); }
    else showToast("Merge failed", "error");
  }

  async function doSplit(table: FloorTable) {
    const res = await fetch("/api/tables/merge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: table.id }),
    });
    if (res.ok) { showToast(`Table ${table.number} unmerged`, "success"); setSelectedTable(null); load(); }
    else showToast("Split failed", "error");
  }

  async function doTransfer(from: FloorTable, to: FloorTable) {
    const res = await fetch("/api/tables/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromTableId: from.id, toTableId: to.id }),
    });
    if (res.ok) { showToast(`Order transferred to Table ${to.number}`, "success"); setTransferSource(null); setMode("view"); load(); }
    else { const d = await res.json(); showToast(d.error ?? "Transfer failed", "error"); }
  }

  async function setTableStatus(table: FloorTable, status: TableStatus) {
    await fetch(`/api/tables/${table.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
    setSelectedTable(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading floor plan...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <TopBar
        stats={stats}
        occupancyPct={occupancyPct}
        mode={mode}
        setMode={v => { setMode(v); setSelectedTable(null); setMergeSource(null); setTransferSource(null); }}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        sidePanel={sidePanel}
        setSidePanel={setSidePanel}
        waitlistCount={waitlist.length}
        reservationCount={reservations.filter(r => r.status === "CONFIRMED").length}
        onAddTable={() => setShowAddTable(true)}
      />

      {/* ── Mode Banner ─────────────────────────────────────────────────── */}
      {mode !== "view" && (
        <ModeBanner mode={mode} mergeSource={mergeSource} transferSource={transferSource} />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto relative">
          <div
            ref={canvasRef}
            className="relative select-none"
            style={{ width: CANVAS_W, height: CANVAS_H, backgroundImage: "radial-gradient(circle, #ffffff08 1px, transparent 1px)", backgroundSize: `${GRID}px ${GRID}px` }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {visibleTables.map(table => (
              <TableNode
                key={table.id}
                table={table}
                isSelected={selectedTable?.id === table.id}
                isMergeSource={mergeSource?.id === table.id}
                isTransferSource={transferSource?.id === table.id}
                mode={mode}
                allTables={tables}
                onMouseDown={e => onMouseDown(e, table)}
                onClick={() => onTableClick(table)}
              />
            ))}
          </div>
        </div>

        {/* ── Side Panel ──────────────────────────────────────────────────── */}
        {sidePanel !== "none" && (
          <SidePanel
            panel={sidePanel}
            reservations={reservations}
            waitlist={waitlist}
            tables={tables}
            onClose={() => setSidePanel("none")}
            onAddWaitlist={() => setShowWaitlistForm(true)}
            onAddReservation={() => setShowReservationForm(true)}
            onWaitlistUpdate={load}
          />
        )}
      </div>

      {/* ── Quick Actions Panel ─────────────────────────────────────────── */}
      {selectedTable && mode === "view" && (
        <QuickActions
          table={selectedTable}
          tables={tables}
          onClose={() => setSelectedTable(null)}
          onSplit={doSplit}
          onSetStatus={setTableStatus}
          onOpenOrder={() => { window.location.href = "/dashboard/tables"; }}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showAddTable && <AddTableModal onClose={() => setShowAddTable(false)} onSave={load} />}
      {showWaitlistForm && <WaitlistForm onClose={() => setShowWaitlistForm(false)} onSave={() => { setShowWaitlistForm(false); load(); }} />}
      {showReservationForm && (
        <ReservationForm tables={tables} onClose={() => setShowReservationForm(false)} onSave={() => { setShowReservationForm(false); load(); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TopBar({ stats, occupancyPct, mode, setMode, activeSection, setActiveSection, sidePanel, setSidePanel, waitlistCount, reservationCount, onAddTable }: {
  stats: { total: number; free: number; occupied: number; reserved: number };
  occupancyPct: number; mode: string;
  setMode: (v: "view" | "drag" | "merge" | "transfer") => void;
  activeSection: string; setActiveSection: (v: string) => void;
  sidePanel: string; setSidePanel: (v: "none" | "reservations" | "waitlist") => void;
  waitlistCount: number; reservationCount: number; onAddTable: () => void;
}) {
  return (
    <div className="bg-gray-900 border-b border-gray-700/50 px-4 py-2 flex items-center gap-4 flex-wrap shrink-0">
      {/* Stats */}
      <div className="flex items-center gap-3 text-sm">
        <StatPill label="Total" value={stats.total} color="text-gray-300" />
        <StatPill label="Free" value={stats.free} color="text-emerald-400" />
        <StatPill label="Occupied" value={stats.occupied} color="text-red-400" />
        <StatPill label="Reserved" value={stats.reserved} color="text-amber-400" />
        <div className="px-2 py-0.5 bg-gray-800 rounded text-xs font-mono text-purple-300">{occupancyPct}% full</div>
      </div>

      <div className="h-5 w-px bg-gray-700" />

      {/* Section tabs */}
      <div className="flex gap-1">
        {["All", ...SECTIONS].map(s => (
          <button key={s} onClick={() => setActiveSection(s)}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${activeSection === s ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-gray-700" />

      {/* Mode buttons */}
      <div className="flex gap-1">
        {([
          { v: "view", icon: "👁", label: "View" },
          { v: "drag", icon: "✋", label: "Move" },
          { v: "merge", icon: "🔗", label: "Merge" },
          { v: "transfer", icon: "↔️", label: "Transfer" },
        ] as const).map(({ v, icon, label }) => (
          <button key={v} onClick={() => setMode(v)}
            className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${mode === v ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}>
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex gap-2">
        <button onClick={() => setSidePanel(sidePanel === "reservations" ? "none" : "reservations")}
          className={`relative px-3 py-1.5 rounded text-xs font-medium transition-all ${sidePanel === "reservations" ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
          📅 Reservations {reservationCount > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] px-1 rounded-full">{reservationCount}</span>}
        </button>
        <button onClick={() => setSidePanel(sidePanel === "waitlist" ? "none" : "waitlist")}
          className={`relative px-3 py-1.5 rounded text-xs font-medium transition-all ${sidePanel === "waitlist" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
          ⏳ Waitlist {waitlistCount > 0 && <span className="ml-1 bg-purple-500 text-white text-[10px] px-1 rounded-full">{waitlistCount}</span>}
        </button>
        <button onClick={onAddTable}
          className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1">
          + Add Table
        </button>
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-500">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

function ModeBanner({ mode, mergeSource, transferSource }: {
  mode: string; mergeSource: FloorTable | null; transferSource: FloorTable | null;
}) {
  const msgs: Record<string, string> = {
    drag: "✋ Drag mode — click and drag tables to reposition. Positions auto-save on drop.",
    merge: mergeSource ? `🔗 Now click the table to merge with Table ${mergeSource.number}` : "🔗 Merge mode — click the primary table first",
    transfer: transferSource ? `↔️ Now click the destination table for Table ${transferSource.number}` : "↔️ Transfer mode — click an occupied table to move its order",
  };
  const colors: Record<string, string> = { drag: "bg-indigo-900/50 border-indigo-500/50", merge: "bg-purple-900/50 border-purple-500/50", transfer: "bg-blue-900/50 border-blue-500/50" };
  return (
    <div className={`px-4 py-2 text-xs text-center font-medium border-b animate-pulse ${colors[mode] ?? ""}`}>
      {msgs[mode] ?? ""}
    </div>
  );
}

function TableNode({ table, isSelected, isMergeSource, isTransferSource, mode, allTables, onMouseDown, onClick }: {
  table: FloorTable; isSelected: boolean; isMergeSource: boolean; isTransferSource: boolean;
  mode: string; allTables: FloorTable[];
  onMouseDown: (e: React.MouseEvent) => void; onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[table.status];
  const hasActiveOrder = table.orders?.some(o => ["PENDING", "PREPARING", "READY"].includes(o.status));
  const itemCount = table.orders?.reduce((s, o) => s + o.items.reduce((s2, i) => s2 + i.quantity, 0), 0) ?? 0;
  const mergedLabel = table.mergedWith ? allTables.find(t => t.id === table.mergedWith)?.number : null;
  const isRound = table.shape === "round";

  const highlight = isSelected ? "ring-4 ring-white scale-105" : isMergeSource ? "ring-4 ring-purple-400 scale-105" : isTransferSource ? "ring-4 ring-blue-400 scale-105" : "";
  const cursor = mode === "drag" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer";

  return (
    <div
      className={`absolute transition-all duration-150 ${cursor} group`}
      style={{ left: table.posX, top: table.posY, width: GRID * 1.05, height: GRID * 1.05 }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {/* Table body */}
      <div className={`relative w-full h-full flex flex-col items-center justify-center border-2 shadow-lg transition-all duration-200
        ${cfg.bg} ${cfg.border} ${highlight} ${isRound ? "rounded-full" : "rounded-xl"}
        hover:brightness-125 hover:shadow-xl`}
        style={{ boxShadow: isSelected ? `0 0 20px 4px ${table.status === "OCCUPIED" ? "#ef444440" : table.status === "RESERVED" ? "#f59e0b40" : "#22c55e40"}` : undefined }}
      >
        {/* Status dot */}
        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />

        {/* Merge badge */}
        {table.mergedWith && (
          <div className="absolute -top-2 -left-2 bg-purple-500 text-white text-[9px] px-1 rounded-full font-bold">M</div>
        )}

        {/* Table number */}
        <div className={`text-lg font-black ${cfg.text}`}>{table.number}</div>

        {/* Capacity */}
        <div className="text-gray-400 text-[10px] flex items-center gap-0.5">
          {"🪑".repeat(Math.min(table.capacity, 4))}
          {table.capacity > 4 && `+${table.capacity - 4}`}
        </div>

        {/* Item count badge */}
        {hasActiveOrder && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] px-1.5 rounded-full font-bold shadow">
            {itemCount} items
          </div>
        )}

        {/* Merged with info */}
        {mergedLabel && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-purple-300 text-[9px] whitespace-nowrap">
            + T{mergedLabel}
          </div>
        )}
      </div>

      {/* Hover tooltip */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        Table {table.number} • {cfg.label} • {table.capacity} seats • {table.section}
      </div>
    </div>
  );
}

function QuickActions({ table, tables, onClose, onSplit, onSetStatus, onOpenOrder }: {
  table: FloorTable; tables: FloorTable[];
  onClose: () => void; onSplit: (t: FloorTable) => void;
  onSetStatus: (t: FloorTable, s: TableStatus) => void; onOpenOrder: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4 animate-in slide-in-from-bottom duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-40">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG[table.status].dot}`} />
              <span className="font-bold text-white">Table {table.number}</span>
              <span className={`text-xs ${STATUS_CONFIG[table.status].text}`}>{STATUS_CONFIG[table.status].label}</span>
            </div>
            <p className="text-gray-400 text-xs">{table.capacity} seats • {table.section} {table.mergedWith ? `• Merged with T${tables.find(t => t.id === table.mergedWith)?.number ?? "?"}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {table.status === "OCCUPIED" && (
              <ActionBtn color="indigo" onClick={onOpenOrder}>🧾 Open Order</ActionBtn>
            )}
            {table.status === "FREE" && (
              <ActionBtn color="emerald" onClick={() => onOpenOrder()}>➕ New Order</ActionBtn>
            )}
            {table.status !== "RESERVED" && (
              <ActionBtn color="amber" onClick={() => onSetStatus(table, "RESERVED")}>📅 Mark Reserved</ActionBtn>
            )}
            {table.status === "RESERVED" && (
              <ActionBtn color="emerald" onClick={() => onSetStatus(table, "FREE")}>✓ Mark Free</ActionBtn>
            )}
            {table.mergedWith && (
              <ActionBtn color="purple" onClick={() => onSplit(table)}>🔀 Split Table</ActionBtn>
            )}
            <ActionBtn color="gray" onClick={onClose}>✕ Close</ActionBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ color, onClick, children }: { color: string; onClick: () => void; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-600 hover:bg-indigo-500",
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    amber: "bg-amber-600 hover:bg-amber-500",
    purple: "bg-purple-600 hover:bg-purple-500",
    red: "bg-red-600 hover:bg-red-500",
    gray: "bg-gray-700 hover:bg-gray-600",
  };
  return (
    <button onClick={onClick} className={`px-3 py-2 rounded-lg text-sm font-medium text-white transition-all ${colors[color] ?? colors.gray}`}>
      {children}
    </button>
  );
}

function SidePanel({ panel, reservations, waitlist, tables, onClose, onAddWaitlist, onAddReservation, onWaitlistUpdate }: {
  panel: string; reservations: Reservation[]; waitlist: WaitlistEntry[]; tables: FloorTable[];
  onClose: () => void; onAddWaitlist: () => void; onAddReservation: () => void; onWaitlistUpdate: () => void;
}) {
  async function removeWaitlist(id: string) {
    await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
    onWaitlistUpdate();
  }
  async function seatWaitlist(id: string) {
    await fetch(`/api/waitlist/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "SEATED" }) });
    onWaitlistUpdate();
  }

  const today = new Date().toDateString();
  const todayRes = reservations.filter(r => new Date(r.date).toDateString() === today);

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700/50 flex flex-col overflow-hidden shrink-0 animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h3 className="font-semibold text-sm">{panel === "reservations" ? "📅 Reservations" : "⏳ Waitlist"}</h3>
        <div className="flex gap-2">
          <button onClick={panel === "reservations" ? onAddReservation : onAddWaitlist}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded font-medium transition-colors">
            + Add
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-sm">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {panel === "reservations" && (
          todayRes.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No reservations today</p>
          ) : todayRes.map(r => (
            <div key={r.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{r.customerName}</p>
                  <p className="text-gray-400 text-xs">{r.customerPhone}</p>
                  <p className="text-amber-300 text-xs mt-1">
                    {new Date(r.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {r.partySize} guests
                  </p>
                  {r.tableId && <p className="text-indigo-300 text-xs">Table {tables.find(t => t.id === r.tableId)?.number ?? "?"}</p>}
                  {r.notes && <p className="text-gray-500 text-xs mt-1 italic">{r.notes}</p>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.status === "CONFIRMED" ? "bg-emerald-900 text-emerald-300" : "bg-gray-700 text-gray-400"}`}>
                  {r.status}
                </span>
              </div>
            </div>
          ))
        )}

        {panel === "waitlist" && (
          waitlist.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Waitlist is empty</p>
          ) : waitlist.map((w, i) => {
            const waited = Math.floor((Date.now() - new Date(w.createdAt).getTime()) / 60000);
            return (
              <div key={w.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                    <div>
                      <p className="font-medium text-sm">{w.customerName}</p>
                      <p className="text-gray-400 text-xs">{w.partySize} guests • {w.customerPhone}</p>
                      <p className={`text-xs mt-0.5 ${waited > (w.estimatedWait ?? 15) ? "text-red-400" : "text-emerald-400"}`}>
                        Waited: {waited}m {w.estimatedWait ? `/ ~${w.estimatedWait}m` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => seatWaitlist(w.id)}
                      className="text-[10px] bg-emerald-700 hover:bg-emerald-600 px-2 py-1 rounded transition-colors">Seat</button>
                    <button onClick={() => removeWaitlist(w.id)}
                      className="text-[10px] bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors">✕</button>
                  </div>
                </div>
                {w.notes && <p className="text-gray-500 text-xs mt-1 italic">{w.notes}</p>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AddTableModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [shape, setShape] = useState<TableShape>("square");
  const [section, setSection] = useState("Main Hall");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!number.trim()) return;
    setSaving(true);
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: number.trim(), capacity, shape, section, posX: 0, posY: 0 }),
    });
    if (res.ok) { showToast("Table added", "success"); onSave(); onClose(); }
    else { const d = await res.json(); showToast(d.error ?? "Failed", "error"); }
    setSaving(false);
  }

  return (
    <Modal title="Add Table" onClose={onClose}>
      <label className="text-xs text-gray-400">Table Number</label>
      <input value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. T1"
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1 mb-3" />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-400">Capacity</label>
          <input type="number" value={capacity} min={1} max={20} onChange={e => setCapacity(+e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs text-gray-400">Shape</label>
          <select value={shape} onChange={e => setShape(e.target.value as TableShape)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1">
            <option value="square">Square</option>
            <option value="round">Round</option>
          </select>
        </div>
      </div>
      <label className="text-xs text-gray-400">Section</label>
      <select value={section} onChange={e => setSection(e.target.value)}
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1 mb-4">
        {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <button onClick={save} disabled={saving || !number.trim()}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 rounded font-medium transition-colors">
        {saving ? "Adding..." : "Add Table"}
      </button>
    </Modal>
  );
}

function WaitlistForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2); const [wait, setWait] = useState(15);
  const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: name, customerPhone: phone, partySize: party, estimatedWait: wait, notes }),
    });
    if (res.ok) { showToast("Added to waitlist", "success"); onSave(); }
    else showToast("Failed", "error");
    setSaving(false);
  }

  return (
    <Modal title="Add to Waitlist" onClose={onClose}>
      <label className="text-xs text-gray-400">Customer Name *</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe"
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1 mb-3" />
      <label className="text-xs text-gray-400">Phone</label>
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1 mb-3" />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-400">Party Size</label>
          <input type="number" value={party} min={1} max={20} onChange={e => setParty(+e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs text-gray-400">Est. Wait (min)</label>
          <input type="number" value={wait} min={5} max={120} onChange={e => setWait(+e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1" />
        </div>
      </div>
      <label className="text-xs text-gray-400">Notes</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Special requirements..."
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1 mb-4 resize-none" />
      <button onClick={save} disabled={saving || !name.trim()}
        className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-2 rounded font-medium transition-colors">
        {saving ? "Adding..." : "Add to Waitlist"}
      </button>
    </Modal>
  );
}

function ReservationForm({ tables, onClose, onSave }: { tables: FloorTable[]; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2); const [tableId, setTableId] = useState("");
  const [date, setDate] = useState(""); const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !date) return;
    setSaving(true);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: name, customerPhone: phone, partySize: party, tableId: tableId || null, date, notes }),
    });
    if (res.ok) { showToast("Reservation created", "success"); onSave(); }
    else showToast("Failed", "error");
    setSaving(false);
  }

  return (
    <Modal title="New Reservation" onClose={onClose}>
      <label className="text-xs text-gray-400">Customer Name *</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe"
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1 mb-3" />
      <label className="text-xs text-gray-400">Phone</label>
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1 mb-3" />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-400">Party Size</label>
          <input type="number" value={party} min={1} max={20} onChange={e => setParty(+e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs text-gray-400">Table</label>
          <select value={tableId} onChange={e => setTableId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1">
            <option value="">Any Table</option>
            {tables.filter(t => t.status === "FREE").map(t => (
              <option key={t.id} value={t.id}>Table {t.number} ({t.capacity})</option>
            ))}
          </select>
        </div>
      </div>
      <label className="text-xs text-gray-400">Date & Time *</label>
      <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1 mb-3" />
      <label className="text-xs text-gray-400">Notes</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Special requirements..."
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm mt-1 mb-4 resize-none" />
      <button onClick={save} disabled={saving || !name.trim() || !date}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-2 rounded font-medium transition-colors">
        {saving ? "Saving..." : "Create Reservation"}
      </button>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
