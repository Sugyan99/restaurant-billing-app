import { DeleteButton } from "@/components/DeleteButton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Customer = {
  id: string; name: string; phone: string; email?: string;
  address?: string; totalVisits: number; totalSpent: number; createdAt: string;
};

const EMPTY = { name: "", phone: "", email: "", address: "" };

export default function CustomersPage() {
  const { isOwner } = useCurrentUser();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/customers${q}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.name.trim()) { showToast("Name is required", "error"); return; }
    if (form.phone.length < 10) { showToast("Valid phone number is required", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message ?? "Customer added!");
      setShowModal(false);
      setForm(EMPTY);
      await load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Customers</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>{customers.length} customers</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Customer</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px" }}>
          <input className="form-input" placeholder="🔍 Search by name or phone..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {customers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          <p style={{ fontWeight: 600 }}>{search ? "No customers found" : "No customers yet"}</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["Customer", "Phone", "Email", "Total Visits", "Total Spent", "Since", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {c.address && <div style={{ fontSize: 11, color: "#94A3B8" }}>{c.address}</div>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{c.phone}</td>
                    <td style={{ padding: "12px 16px", color: "#64748B" }}>{c.email || "—"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 700 }}>{c.totalVisits}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#E8721C" }}>₹{c.totalSpent.toFixed(2)}</td>
                    <td style={{ padding: "12px 16px", color: "#64748B" }}>
                      {new Date(c.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {isOwner && <DeleteButton url={`/api/customers/${c.id}`} onDeleted={load} confirmMsg="Delete customer?" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3 className="modal-title">Add Customer</h3>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" placeholder="Customer name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input className="form-input" placeholder="10-digit mobile number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="Optional" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" placeholder="Optional" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>
                {loading ? "Saving..." : "Add Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
