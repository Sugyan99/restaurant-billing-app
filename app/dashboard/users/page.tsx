"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Role = "OWNER" | "MANAGER" | "CASHIER" | "KITCHEN";
type User = {
  id: string; name: string; email: string; role: Role;
  phone?: string; isActive: boolean; createdAt: string; salary?: number;
};

const ROLES = ["OWNER", "MANAGER", "CASHIER", "KITCHEN"] as const;
const ROLE_COLORS: Record<Role, string> = { OWNER: "#7C3AED", MANAGER: "#2563EB", CASHIER: "#16A34A", KITCHEN: "#D97706" };
const ROLE_ICONS: Record<Role, string> = { OWNER: "👑", MANAGER: "🏪", CASHIER: "💳", KITCHEN: "👨‍🍳" };
const EMPTY_FORM = { name: "", email: "", password: "", role: "CASHIER" as Role, phone: "", salary: "" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => { const res = await fetch("/api/users"); const data = await res.json(); setUsers(data.users ?? []); }, []);
  useEffect(() => { load(); }, [load]);
  function openCreate() { setEditUser(null); setForm(EMPTY_FORM); setShowPassword(false); setShowModal(true); }
  function openEdit(user: User) { setEditUser(user); setForm({ name: user.name, email: user.email, password: "", role: user.role, phone: user.phone ?? "", salary: user.salary != null ? String(user.salary) : "" }); setShowPassword(false); setShowModal(true); }

  async function save() {
    if (!form.name.trim()) return showToast("Name is required", "error");
    if (!editUser && !form.email.trim()) return showToast("Email is required", "error");
    if (!editUser && form.password.length < 6) return showToast("Password must be at least 6 characters", "error");
    if (form.password && form.password.length < 6) return showToast("Password must be at least 6 characters", "error");
    setLoading(true);
    try {
      const body: Record<string, unknown> = { name: form.name, role: form.role, phone: form.phone };
      if (form.salary !== "") body.salary = Number(form.salary);
      if (!editUser) { body.email = form.email; body.password = form.password; } else if (form.password) body.password = form.password;
      const res = await fetch(editUser ? `/api/users/${editUser.id}` : "/api/users", { method: editUser ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      showToast(editUser ? "Staff updated!" : "Staff account created!"); setShowModal(false); setEditUser(null); setForm(EMPTY_FORM); await load();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Failed to save", "error"); } finally { setLoading(false); }
  }

  async function toggleActive(user: User) {
    const res = await fetch(`/api/users/${user.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !user.isActive }) });
    if (res.ok) { showToast(user.isActive ? `${user.name} deactivated` : `${user.name} activated`); await load(); } else showToast((await res.json()).error, "error");
  }
  async function deleteUser(user: User) {
    if (!confirm(`Delete/deactivate ${user.name}? This performs a soft delete.`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" }); const data = await res.json();
    if (res.ok) { showToast(`${user.name} deleted`); await load(); } else showToast(data.error, "error");
  }

  const active = users.filter(u => u.isActive), inactive = users.filter(u => !u.isActive);
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10 }}>
      <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Staff Management</h2><p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>{active.length} active · {inactive.length} inactive</p></div>
      <div style={{ display: "flex", gap: 8 }}><Link className="btn btn-ghost" href="/dashboard/users/operations">Advanced Staff Operations</Link><button className="btn btn-primary" onClick={openCreate}>+ Add Staff</button></div>
    </div>
    <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>{ROLES.map(role => <div key={role} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: ROLE_COLORS[role], display: "inline-block" }} />{ROLE_ICONS[role]} {role}</div>)}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
      {active.map(user => <div key={user.id} className="card" style={{ padding: 20 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: `${ROLE_COLORS[user.role]}20`, border: `2px solid ${ROLE_COLORS[user.role]}40` }}>{ROLE_ICONS[user.role]}</div><div><div style={{ fontWeight: 700, fontSize: 15 }}>{user.name}</div><div style={{ fontSize: 12, color: "#64748B" }}>{user.email}</div>{user.phone && <div style={{ fontSize: 12, color: "#94A3B8" }}>📞 {user.phone}</div>}</div></div><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${ROLE_COLORS[user.role]}15`, color: ROLE_COLORS[user.role] }}>{user.role}</span></div><div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn btn-ghost btn-sm" onClick={() => openEdit(user)}>✏️ Edit</button><button className="btn btn-danger btn-sm" onClick={() => toggleActive(user)}>🚫 Deactivate</button><button className="btn btn-danger btn-sm" onClick={() => deleteUser(user)}>🗑 Delete</button></div></div>)}
    </div>
    {inactive.length > 0 && <div className="card"><div className="card-header"><h3 className="card-title">Inactive Staff ({inactive.length})</h3></div><div style={{ padding: "0 20px 20px" }}>{inactive.map(user => <div key={user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F1F5F9", opacity: .6 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span>{ROLE_ICONS[user.role]}</span><div><div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div><div style={{ fontSize: 12, color: "#94A3B8" }}>{user.role} · {user.email}</div></div></div><div style={{ display: "flex", gap: 8 }}><button className="btn btn-success btn-sm" onClick={() => toggleActive(user)}>✓ Reactivate</button><button className="btn btn-danger btn-sm" onClick={() => deleteUser(user)}>🗑 Delete</button></div></div>)}</div></div>}
    {users.length === 0 && <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}><div style={{ fontSize: 40, marginBottom: 12 }}>👥</div><p style={{ fontSize: 15, fontWeight: 600 }}>No staff accounts yet</p><button className="btn btn-primary" onClick={openCreate}>+ Add First Staff</button></div>}
    {showModal && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}><div className="modal" style={{ maxWidth: 480 }}><h3 className="modal-title">{editUser ? `Edit ${editUser.name}` : "Add New Staff"}</h3>
      <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></div>
      <div className="form-group"><label className="form-label">Email Address *</label><input className="form-input" type="email" value={form.email} disabled={!!editUser} onChange={e => setForm({ ...form, email: e.target.value })}/></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><div className="form-group"><label className="form-label">Role *</label><select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>{ROLES.map(r => <option key={r} value={r}>{ROLE_ICONS[r]} {r}</option>)}</select></div><div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></div></div>
      <div className="form-group"><label className="form-label">Salary</label><input className="form-input" type="number" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })}/></div>
      <div className="form-group"><label className="form-label">{editUser ? "New Password (leave blank to keep)" : "Password *"}</label><div style={{ position: "relative" }}><input className="form-input" type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ paddingRight: 44 }}/><button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 10, top: 8, background: "none", border: "none", cursor: "pointer" }}>{showPassword ? "🙈" : "👁️"}</button></div></div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? "Saving..." : editUser ? "Update Staff" : "Create Account"}</button></div>
    </div></div>}
  </div>;
}
