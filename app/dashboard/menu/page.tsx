"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";
import { PageTabs } from "@/components/PageTabs";
import ImportPage from "@/app/dashboard/import/page";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

type Category = { id: string; name: string; sortOrder: number; items: MenuItem[] };
type MenuItem = { id: string; name: string; price: number; isVeg: boolean; isAvailable: boolean; description?: string };

type ItemForm = { name: string; price: string; isVeg: boolean; isAvailable: boolean; description: string; categoryId: string };

const EMPTY_FORM: ItemForm = { name: "", price: "", isVeg: true, isAvailable: true, description: "", categoryId: "" };

export default function MenuPage() {
  return (
    <PageTabs tabs={[
      { id: "menu",   label: "Menu Items", icon: "🍽️" },
      { id: "import", label: "Import CSV", icon: "⬆️" },
    ]}>
      {tab => tab === "import" ? <ImportPage /> : <MenuContent />}
    </PageTabs>
  );
}

function MenuContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<"items" | "categories">("items");
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_FORM);
  const [catName, setCatName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAddItem(categoryId?: string) {
    setEditItem(null);
    const firstCatId = categoryId ?? categories[0]?.id ?? "";
    if (!firstCatId) {
      showToast("Please add a category first, then add items", "error");
      setActiveTab("categories");
      setShowCatModal(true);
      return;
    }
    setItemForm({ ...EMPTY_FORM, categoryId: firstCatId });
    setShowItemModal(true);
  }

  function openEditItem(item: MenuItem, categoryId: string) {
    setEditItem(item);
    setItemForm({
      name: item.name, price: String(item.price), isVeg: item.isVeg,
      isAvailable: item.isAvailable, description: item.description ?? "", categoryId,
    });
    setShowItemModal(true);
  }

  async function saveItem() {
    setLoading(true);
    if (!itemForm.name.trim()) { showToast("Item name required", "error"); setLoading(false); return; }
    if (!itemForm.price || parseFloat(itemForm.price) <= 0) { showToast("Valid price required", "error"); setLoading(false); return; }
    if (!itemForm.categoryId) { showToast("Please select a category", "error"); setLoading(false); return; }
    const body = { ...itemForm, price: parseFloat(itemForm.price) };
    try {
      const url = editItem ? `/api/menu-items/${editItem.id}` : "/api/menu-items";
      const res = await fetch(url, {
        method: editItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(editItem ? "Item updated!" : "Item added!");
      setShowItemModal(false);
      await load();
    } catch (err: any) {
      showToast(err.message ?? "Failed to save", "error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAvailable(item: MenuItem, categoryId: string) {
    const res = await fetch(`/api/menu-items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, categoryId, isAvailable: !item.isAvailable }),
    });
    if (res.ok) {
      showToast(item.isAvailable ? "Item marked unavailable" : "Item is now available");
      await load();
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`/api/menu-items/${id}`, { method: "DELETE" });
    const data = await res.json();
    showToast(data.message ?? "Item deleted");
    await load();
  }

  async function addCategory() {
    if (!catName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: catName.trim() }),
    });
    if (res.ok) {
      showToast("Category added!");
      setCatName("");
      setShowCatModal(false);
      await load();
    } else {
      showToast((await res.json()).error ?? "Failed", "error");
    }
    setLoading(false);
  }

  const allItems = categories.flatMap((c) => c.items.map((i) => ({ ...i, categoryId: c.id, categoryName: c.name })));
  const filtered = searchTerm ? allItems.filter((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase())) : allItems;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"center", mb:2.5, flexWrap:"wrap", gap:1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight:800, fontSize:{ xs:18, md:20 } }}>Menu Management</Typography>
          <Typography sx={{ fontSize:13, color:"text.secondary", mt:.25 }}>
            {allItems.length} items across {categories.length} categories
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => setShowCatModal(true)}>+ Category</Button>
          <Button size="small" variant="contained" onClick={() => openAddItem()}>+ Add Item</Button>
        </Stack>
      </Box>

      {/* Tabs */}
      <Stack direction="row" spacing={1} sx={{ mb:2.5 }}>
        {(["items","categories"] as const).map(t => (
          <Button key={t} size="small" variant={activeTab===t?"contained":"outlined"} onClick={() => setActiveTab(t)} sx={{ textTransform:"capitalize" }}>
            {t === "items" ? "All Items" : "Categories"}
          </Button>
        ))}
      </Stack>

      {activeTab === "items" ? (
        <Box>
          <Card elevation={0} sx={{ mb:2 }}>
            <CardContent sx={{ p:"12px 16px!important" }}>
              <TextField fullWidth size="small" placeholder="🔍 Search menu items..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} />
            </CardContent>
          </Card>

          {(searchTerm ? [{ id:"search", name:"Search Results", sortOrder:0, items:filtered }] : categories).map(cat => {
            const items = searchTerm ? filtered : cat.items.map(i => ({ ...i, categoryId: cat.id, categoryName: cat.name }));
            if (items.length === 0 && !searchTerm) return null;
            return (
              <Card key={cat.id} elevation={0} sx={{ mb:2 }}>
                <CardHeader
                  title={<Typography sx={{ fontWeight:700, fontSize:15 }}>{cat.name} <Chip label={items.length} size="small" sx={{ ml:.5, fontSize:11 }}/></Typography>}
                  action={!searchTerm && <Button size="small" variant="outlined" onClick={() => openAddItem(cat.id)} sx={{ fontSize:11 }}>+ Add to {cat.name}</Button>}
                  sx={{ pb:0, px:2, pt:1.5 }}
                />
                {items.length === 0
                  ? <CardContent><Typography sx={{ color:"text.secondary", fontSize:13 }}>No items yet.</Typography></CardContent>
                  : <Box sx={{ overflowX:"auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ "& th":{ fontSize:11, fontWeight:700, color:"text.secondary", textTransform:"uppercase", letterSpacing:.4 } }}>
                            {["Item","Type","Price","Status","Actions"].map(h => <TableCell key={h}>{h}</TableCell>)}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {items.map(item => (
                            <TableRow key={item.id} sx={{ opacity: item.isAvailable ? 1 : .5, "&:last-child td":{ border:0 } }}>
                              <TableCell>
                                <Typography sx={{ fontWeight:600, fontSize:13 }}>{item.name}</Typography>
                                {item.description && <Typography sx={{ fontSize:11, color:"text.secondary" }}>{item.description}</Typography>}
                              </TableCell>
                              <TableCell>
                                <Chip label={item.isVeg ? "Veg" : "Non-Veg"} size="small"
                                  sx={{ fontSize:10, bgcolor: item.isVeg?"#DCFCE7":"#FEE2E2", color: item.isVeg?"#16A34A":"#DC2626", fontWeight:600 }}/>
                              </TableCell>
                              <TableCell><Typography sx={{ fontWeight:700, color:"primary.main" }}>₹{item.price.toFixed(2)}</Typography></TableCell>
                              <TableCell>
                                <Chip label={item.isAvailable?"Available":"Unavailable"} size="small"
                                  color={item.isAvailable?"success":"default"} sx={{ fontSize:10 }}/>
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={.5}>
                                  <Button size="small" variant="outlined" sx={{ fontSize:11, minWidth:0, px:1 }} onClick={() => openEditItem(item, item.categoryId)}>Edit</Button>
                                  <Button size="small" variant="outlined" color={item.isAvailable?"error":"success"} sx={{ fontSize:11, minWidth:0, px:1 }}
                                    onClick={() => toggleAvailable(item, item.categoryId)}>
                                    {item.isAvailable?"Disable":"Enable"}
                                  </Button>
                                  <Button size="small" variant="outlined" color="error" sx={{ fontSize:11, minWidth:0, px:1 }} onClick={() => deleteItem(item.id)}>Del</Button>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                }
              </Card>
            );
          })}

          {allItems.length === 0 && (
            <Box sx={{ textAlign:"center", py:8, color:"text.secondary" }}>
              <Typography sx={{ fontSize:40, mb:1.5 }}>🍽️</Typography>
              <Typography sx={{ fontSize:15, fontWeight:600, mb:.5 }}>Menu is empty</Typography>
              <Typography sx={{ fontSize:13, mb:2 }}>Add categories first, then add menu items</Typography>
              <Stack direction="row" spacing={1} sx={{justifyContent:"center"}}>
                <Button variant="outlined" onClick={() => setShowCatModal(true)}>+ Add Category</Button>
                <Button variant="contained" onClick={() => openAddItem()}>+ Add Item</Button>
              </Stack>
            </Box>
          )}
        </Box>
      ) : (
        <Box>
          {categories.length === 0 ? (
            <Box sx={{ textAlign:"center", py:8, color:"text.secondary" }}>
              <Typography sx={{ fontSize:40, mb:1.5 }}>📂</Typography>
              <Typography sx={{ fontSize:15, fontWeight:600, mb:2 }}>No categories yet</Typography>
              <Button variant="contained" onClick={() => setShowCatModal(true)}>+ Add Category</Button>
            </Box>
          ) : (
            <Grid container spacing={1.5}>
              {categories.map(c => (
                <Grid key={c.id} size={{ xs:6, sm:4, md:3 }}>
                  <Card elevation={0} sx={{ p:2 }}>
                    <Typography sx={{ fontSize:15, fontWeight:700, mb:.5 }}>{c.name}</Typography>
                    <Typography sx={{ fontSize:12, color:"text.secondary", mb:1.5 }}>{c.items.length} items</Typography>
                    <Button size="small" variant="outlined" fullWidth onClick={() => { openAddItem(c.id); setActiveTab("items"); }}>
                      + Add Item
                    </Button>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowItemModal(false)}>
          <div className="modal">
            <h3 className="modal-title">{editItem ? "Edit Item" : "Add Menu Item"}</h3>
            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input className="form-input" placeholder="e.g. Paneer Butter Masala" value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="Optional description" value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Price (₹) *</label>
                <input className="form-input" type="number" placeholder="0.00" value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-select" value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="type" checked={itemForm.isVeg} onChange={() => setItemForm({ ...itemForm, isVeg: true })} />
                <span className="veg-dot veg" /> Veg
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="type" checked={!itemForm.isVeg} onChange={() => setItemForm({ ...itemForm, isVeg: false })} />
                <span className="veg-dot nonveg" /> Non-Veg
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowItemModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveItem} disabled={loading}>
                {loading ? "Saving..." : editItem ? "Update Item" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCatModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCatModal(false)}>
          <div className="modal">
            <h3 className="modal-title">Add Category</h3>
            <div className="form-group">
              <label className="form-label">Category Name</label>
              <input className="form-input" placeholder="e.g. Starters, Main Course, Beverages" value={catName}
                onChange={(e) => setCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowCatModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addCategory} disabled={loading}>Add Category</button>
            </div>
          </div>
        </div>
      )}
    </Box>
  );
}
