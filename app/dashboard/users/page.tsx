"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type User = {
  id: string; name: string; email: string; role: string;
  phone?: string; isActive: boolean; createdAt: string;
};

const ROLES = ["OWNER", "MANAGER", "CASHIER", "KITCHEN"] as const;
const ROLE_COLORS: Record<string, string> = {
  OWNER: "#7C3AED", MANAGER: "#2563EB", CASHIER: "#16A34A", KITCHEN: "#D97706",
};
const ROLE_ICONS: Record<string, string> = {
  OWNER: "👑", MANAGER: "🏪", CASHIER: "💳", KITCHEN: "👨‍🍳",
};

const EMPTY_FORM = { name: "", email: "", password: "", role: "CASHIER" as const, phone: "" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(user: User) {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, password: "", role: user.role as typeof ROLES[number], phone: user.phone ?? "" });
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim()) { showToast("Name is required", "error"); return; }
    if (!editUser && !form.email.trim()) { showToast("Email is required", "error"); return; }
    if (!editUser && form.password.length < 6) { showToast("Password must be at least 6 characters", "error"); return; }

    setLoading(true);
    try {
      const body: Record<string, string> = { name: form.name, role: form.role, phone: form.phone };
      if (!editUser) { body.email = form.email; body.password = form.password; }
      else if (form.password) { body.password = form.password; }

      const url = editUser ? `/api/users/${editUser.id}` : "/api/users";
      const res = await fetch(url, {
        method: editUser ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(editUser ? "Staff updated!" : "Staff account created!");
      setShowModal(false);
      await load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(user: User) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) {
      showToast(user.isActive ? `${user.name} deactivated` : `${user.name} activated`);
      await load();
    } else {
      showToast((await res.json()).error, "error");
    }
  }

  const active = users.filter(u => u.isActive);
  const inactive = users.filter(u => !u.isActive);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Staff Management</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
            {active.length} active · {inactive.length} inactive
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Staff</button>
      </div>

      {/* Role legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {ROLES.map(role => (
          <div key={role} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: ROLE_COLORS[role], display: "inline-block" }} />
            {ROLE_ICONS[role]} {role}
          </div>
        ))}
      </div>

      {/* Staff Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
        {active.map(user => (
          <div key={user.id} className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 20,
                  background: `${ROLE_COLORS[user.role]}20`,
                  border: `2px solid ${ROLE_COLORS[user.role]}40`
                }}>
                  {ROLE_ICONS[user.role]}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{user.email}</div>
                  {user.phone && <div style={{ fontSize: 12, color: "#94A3B8" }}>📞 {user.phone}</div>}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: `${ROLE_COLORS[user.role]}15`, color: ROLE_COLORS[user.role]
              }}>
                {user.role}
              </span>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => openEdit(user)}>
                ✏️ Edit
              </button>
              <button className="btn btn-danger btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => toggleActive(user)}>
                🚫 Deactivate
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Inactive users */}
      {inactive.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Inactive Staff ({inactive.length})</h3>
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            {inactive.map(user => (
              <div key={user.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: "1px solid #F1F5F9", opacity: 0.6
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span>{ROLE_ICONS[user.role]}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>{user.role} · {user.email}</div>
                  </div>
                </div>
                <button className="btn btn-success btn-sm" onClick={() => toggleActive(user)}>
                  ✓ Reactivate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {users.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <p style={{ fontSize: 15, fontWeight: 600 }}>No staff accounts yet</p>
          <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: 12 }}>+ Add First Staff</button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <h3 className="modal-title">{editUser ? `Edit ${editUser.name}` : "Add New Staff"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Full Name *</label>
                <input className="form-input" placeholder="Staff member name" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              {!editUser && (
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Email Address *</label>
                  <input className="form-input" type="email" placeholder="staff@restaurant.com" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-select" value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value as typeof ROLES[number] })}>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_ICONS[r]} {r}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="Phone number" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">{editUser ? "New Password (leave blank to keep)" : "Password *"}</label>
                <div style={{ position: "relative" }}>
                  <input className="form-input" type={showPassword ? "text" : "password"}
                    placeholder={editUser ? "Leave blank to keep current" : "Min. 6 characters"}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    style={{ paddingRight: 44 }} />
                  <button onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            </div>

            {/* Role permissions info */}
            <div style={{ background: "#F8FAFC", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: "#374151" }}>Role Permissions:</div>
              {[
                ["👑 OWNER", "Full access — all features, reports, settings, staff management"],
                ["🏪 MANAGER", "Orders, menu, bills, reports, expenses — no staff management"],
                ["💳 CASHIER", "Orders and billing only"],
                ["👨‍🍳 KITCHEN", "KOT view — see and update order status only"],
              ].map(([role, desc]) => (
                <div key={role} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
                  <span style={{ minWidth: 90 }}>{role}</span>
                  <span style={{ color: "#64748B" }}>{desc}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>
                {loading ? "Saving..." : editUser ? "Update Staff" : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
