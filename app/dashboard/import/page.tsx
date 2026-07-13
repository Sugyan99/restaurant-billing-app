"use client";
import { useState, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Row = { name: string; price: string; category: string; isVeg: string; description: string };
type Category = { id: string; name: string };

export default function ImportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });

  const loadCats = useCallback(async () => {
    const res = await fetch("/api/categories");
    const d = await res.json();
    setCategories(d.categories ?? []);
  }, []);

  function parseCSV(text: string) {
    const lines = text.trim().split("\n");
    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => row[h] = vals[i] ?? "");
      return { name: row.name ?? "", price: row.price ?? "", category: row.category ?? "", isVeg: row.isveg ?? row.is_veg ?? "true", description: row.description ?? "" } as Row;
    }).filter(r => r.name && r.price);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target?.result as string);
      setRows(parsed);
      setResults({ success: 0, failed: 0 });
      loadCats();
    };
    reader.readAsText(file);
  }

  async function importAll() {
    if (!rows.length) return;
    setImporting(true);
    let success = 0, failed = 0;
    for (const row of rows) {
      const cat = categories.find(c => c.name.toLowerCase() === row.category.toLowerCase());
      if (!cat) { failed++; continue; }
      const res = await fetch("/api/menu-items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: row.name, price: parseFloat(row.price), categoryId: cat.id, isVeg: row.isVeg !== "false", description: row.description }),
      });
      res.ok ? success++ : failed++;
    }
    setResults({ success, failed });
    setImporting(false);
    showToast(`Imported ${success} items${failed > 0 ? `, ${failed} failed` : ""}!`);
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>Bulk Menu Import</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748B" }}>Upload a CSV file to add multiple menu items at once</p>

      {/* CSV format guide */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3 className="card-title">📄 CSV Format</h3></div>
        <div className="card-body">
          <code style={{ fontSize: 12, background: "#F8FAFC", padding: "10px 14px", borderRadius: 8, display: "block", whiteSpace: "pre" }}>
{`name,price,category,isVeg,description
Paneer Butter Masala,220,Main Course,true,Rich creamy paneer
Chicken Tikka,280,Starters,false,Tandoor grilled chicken
Mango Lassi,80,Beverages,true,Fresh mango blend`}
          </code>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: "8px 0 0" }}>
            Category names must match exactly with existing categories.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <input type="file" accept=".csv" onChange={handleFile}
            style={{ display: "block", marginBottom: 12 }} />
          {rows.length > 0 && (
            <div style={{ fontSize: 13, color: "#16A34A", fontWeight: 600, marginBottom: 12 }}>
              ✓ {rows.length} items parsed from CSV
            </div>
          )}
          {results.success > 0 && (
            <div style={{ fontSize: 13, marginBottom: 12 }}>
              <span style={{ color: "#16A34A", fontWeight: 700 }}>✓ {results.success} imported</span>
              {results.failed > 0 && <span style={{ color: "#DC2626", fontWeight: 700, marginLeft: 12 }}>✕ {results.failed} failed (category not found)</span>}
            </div>
          )}
          <button className="btn btn-primary" onClick={importAll} disabled={!rows.length || importing}>
            {importing ? `Importing ${rows.length} items...` : `⬆️ Import ${rows.length} Items`}
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Preview ({rows.length} items)</h3></div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Name", "Price", "Category", "Type"].map(h => (
                    <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 16px" }}>{r.name}</td>
                    <td style={{ padding: "8px 16px" }}>₹{r.price}</td>
                    <td style={{ padding: "8px 16px" }}>{r.category}</td>
                    <td style={{ padding: "8px 16px" }}>{r.isVeg === "false" ? "🔴 Non-Veg" : "🟢 Veg"}</td>
                  </tr>
                ))}
                {rows.length > 10 && <tr><td colSpan={4} style={{ padding: "8px 16px", color: "#94A3B8", fontSize: 12 }}>...and {rows.length - 10} more</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
