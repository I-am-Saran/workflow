// App.js
import React, { useEffect, useMemo, useState } from "react";

// Point this at your backend
const API_BASE = "https://approval-workflow-api.onrender.com"; // e.g. https://approval-workflow-api.onrender.com

function useAuth() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("user"); return u ? JSON.parse(u) : null;
  });

  async function login(email, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password }),
    });
    if (!res.ok) throw new Error((await res.json().catch(()=>({}))).detail || "Login failed");
    const data = await res.json();
    setToken(data.access_token); setUser(data.user);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  }

  function logout() {
    setToken(""); setUser(null);
    localStorage.removeItem("token"); localStorage.removeItem("user");
  }

  return { token, user, login, logout, isAuthed: !!token };
}

export default function App() {
  const { token, user, login, logout, isAuthed } = useAuth();
  const [view, setView] = useState("login");

  useEffect(() => {
    if (!isAuthed) setView("login");
    else {
      const r = (user?.role || "").toLowerCase();
      if (["l1", "l2", "l3", "l0", "admin"].includes(r)) setView(r);
      else setView("l1");
    }
  }, [isAuthed, user]);

  return (
    <div className="min-h-screen">
      {/* your existing header/nav can stay — no style changes here */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <div className="font-semibold">Approval Workflow</div>
          <div className="ml-auto flex items-center gap-2">
            {isAuthed && (
              <>
                <span className="opacity-70 text-sm">{user.email} ({user.role})</span>
                <button onClick={logout} className="btn">Logout</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {!isAuthed && <LoginPage onLogin={login} />}
        {isAuthed && view === "l1" && <L1Dashboard token={token} user={user} />}
        {isAuthed && view === "l2" && <ApproverDashboard token={token} role="L2" />}
        {isAuthed && view === "l3" && <ApproverDashboard token={token} role="L3" />}
        {isAuthed && view === "l0" && <L0Dashboard token={token} />}
        {isAuthed && view === "admin" && <AdminDashboard token={token} />}
      </main>
    </div>
  );
}

/* ---------------------- Login ---------------------- */
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("l1@example.com");
  const [password, setPassword] = useState("password");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try { await onLogin(email, password); }
    catch (e) { alert(e.message); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 max-w-md">
      <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email" className="input" />
      <input value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="password" type="password" className="input" />
      <button disabled={loading} className="btn-primary" type="submit">{loading ? "Signing in..." : "Sign in"}</button>
      <div className="text-sm opacity-70">
        Tip: use emails like <code>l1@example.com</code>, <code>l2@example.com</code>, <code>l3@example.com</code>, <code>l0@example.com</code>, <code>admin@example.com</code>.
      </div>
    </form>
  );
}

/* ---------------------- L1 ---------------------- */
function L1Dashboard({ token, user }) {
  const [mine, setMine] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const headers = useMemo(()=>({ Authorization: `Bearer ${token}`, "Content-Type":"application/json" }),[token]);

  async function loadMine() {
    const r = await fetch(`${API_BASE}/api/requests/my-requests`, { headers });
    if (!r.ok) throw new Error("Failed to load requests");
    setMine(await r.json());
  }
  useEffect(()=>{ loadMine().catch(e=>alert(e.message)); },[]); // eslint-disable-line

  async function create() {
    try{
      const r = await fetch(`${API_BASE}/api/requests`, {
        method:"POST", headers,
        body: JSON.stringify({ title, description, requester_email: user.email }),
      });
      if(!r.ok){ const e = await r.json().catch(()=>({})); throw new Error(e.detail || "Failed to create"); }
      setTitle(""); setDescription(""); await loadMine();
      alert("Request submitted.");
    }catch(e){ alert(e.message); }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <input className="input" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Title" />
        <textarea className="input min-h-[100px]" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Description" />
        <button className="btn-primary" onClick={create}>Submit</button>
      </section>

      <section className="overflow-auto">
        <table className="w-full">
          <thead className="opacity-70 text-left">
            <tr><th>ID</th><th>Title</th><th>Status</th><th>Stage</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {mine.map((r)=>(
              <tr key={r.id} className="border-t">
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.status}</td>
                <td>{Array.isArray(r.workflow_snapshot) && r.workflow_snapshot[r.current_stage] ? r.workflow_snapshot[r.current_stage] : `Stage ${r.current_stage+1}`}</td>
                <td>{new Date(r.updated_at || r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {mine.length===0 && <tr><td colSpan="5" className="py-2 opacity-70">No requests yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* ---------------------- L2/L3 ---------------------- */
function ApproverDashboard({ token, role }) {
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);
  const [comment, setComment] = useState("");
  const headers = useMemo(()=>({ Authorization: `Bearer ${token}`, "Content-Type":"application/json" }),[token]);

  async function load() {
    const r = await fetch(`${API_BASE}/api/requests/pending/${role}`, { headers });
    if (!r.ok) throw new Error("Failed to load inbox");
    const data = await r.json();
    setItems(data); setSel(data[0] || null);
  }
  useEffect(()=>{ load().catch(e=>alert(e.message)); },[role]); // eslint-disable-line

  async function act(id, action) {
    try{
      const r = await fetch(`${API_BASE}/api/requests/${id}/action`, {
        method:"POST", headers, body: JSON.stringify({ action, comment })
      });
      if(!r.ok){ const e = await r.json().catch(()=>({})); throw new Error(e.detail || `Failed to ${action}`); }
      setComment("");
      await load();
      alert(`${action === "approve" ? "Approved" : "Rejected"} #${id}`);
    }catch(e){ alert(e.message); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="overflow-auto">
        <table className="w-full">
          <thead className="opacity-70 text-left">
            <tr><th>ID</th><th>Title</th><th>Requester</th><th>Stage</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {items.map((r)=>(
              <tr key={r.id} className="border-t cursor-pointer" onClick={()=>setSel(r)}>
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.requester_email}</td>
                <td>{Array.isArray(r.workflow_snapshot) && r.workflow_snapshot[r.current_stage] ? r.workflow_snapshot[r.current_stage] : `Stage ${r.current_stage+1}`}</td>
                <td>{new Date(r.updated_at || r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {items.length===0 && <tr><td colSpan="5" className="py-2 opacity-70">No pending items.</td></tr>}
          </tbody>
        </table>
      </section>

      <section>
        {!sel && <div className="opacity-70">Select a request from the list.</div>}
        {sel && (
          <div className="grid gap-3">
            <div><b>#{sel.id}</b> — {sel.title}</div>
            <div className="opacity-80">{sel.description}</div>
            <div className="text-sm opacity-70">Requester: {sel.requester_email}</div>
            <div className="text-sm">
              {sel.workflow_snapshot?.[sel.current_stage] ? `Waiting: ${sel.workflow_snapshot[sel.current_stage]}` : `Stage ${sel.current_stage + 1}`}
            </div>
            <textarea className="input min-h-[80px]" value={comment} onChange={(e)=>setComment(e.target.value)} placeholder="Optional comment" />
            <div className="flex gap-2">
              <button className="btn-success" onClick={()=>act(sel.id, "approve")}>Approve</button>
              <button className="btn-danger" onClick={()=>act(sel.id, "reject")}>Reject</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------------- L0 ---------------------- */
function L0Dashboard({ token }) {
  const headers = useMemo(()=>({ Authorization: `Bearer ${token}` }),[token]);
  const [summary, setSummary] = useState({ total:0, pending:0, approved:0, rejected:0, changes_requested:0 });
  const [recent, setRecent] = useState([]);

  async function load() {
    const r = await fetch(`${API_BASE}/api/dashboard`, { headers });
    if(!r.ok) throw new Error("Failed to load dashboard");
    const data = await r.json();
    setSummary(data.summary); setRecent(data.recent);
  }
  useEffect(()=>{ load().catch(e=>alert(e.message)); },[]); // eslint-disable-line

  return (
    <div className="grid gap-6">
      {/* keep your existing stat cards if you have them */}
      <div className="grid gap-3 md:grid-cols-4">
        <Stat title="Total" value={summary.total} />
        <Stat title="Pending" value={summary.pending} />
        <Stat title="Approved" value={summary.approved} />
        <Stat title="Changes Requested" value={summary.changes_requested} />
      </div>

      <section className="overflow-auto">
        <table className="w-full">
          <thead className="opacity-70 text-left">
            <tr><th>ID</th><th>Title</th><th>Status</th><th>At</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {recent.map((r)=>(
              <tr key={r.id} className="border-t">
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.status}</td>
                <td>
                  {r.status === "approved"
                    ? "Completed"
                    : (r.workflow_snapshot?.[r.current_stage]
                        ? `At ${r.workflow_snapshot[r.current_stage]}`
                        : `Stage ${r.current_stage + 1}`)}
                </td>
                <td>{new Date(r.updated_at || r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {recent.length===0 && <tr><td colSpan="5" className="py-2 opacity-70">No activity.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
function Stat({ title, value }) {
  return (
    <div className="p-4 border rounded">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

/* ---------------------- Admin ---------------------- */
function AdminDashboard({ token }) {
  const headers = useMemo(()=>({ Authorization: `Bearer ${token}`, "Content-Type":"application/json" }),[token]);
  const [workflow, setWorkflow] = useState(["L1","L2","L3"]);
  const [newRole, setNewRole] = useState("");

  async function load() {
    const r = await fetch(`${API_BASE}/api/workflow`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data.workflow_order)) setWorkflow(data.workflow_order);
    }
  }
  useEffect(()=>{ load().catch(()=>{}); },[]); // eslint-disable-line

  async function save() {
    const r = await fetch(`${API_BASE}/api/workflow`, { method:"PUT", headers, body: JSON.stringify({ workflow_order: workflow }) });
    if(!r.ok){ const e = await r.json().catch(()=>({})); alert(e.detail || "Failed to save workflow"); return; }
    const data = await r.json();
    setWorkflow(data.workflow_order || workflow);
    alert("Workflow saved: " + (data.workflow_order || workflow).join(" → "));
  }

  function up(i){ if(i<=0) return; const arr=[...workflow]; const [x]=arr.splice(i,1); arr.splice(i-1,0,x); setWorkflow(arr); }
  function down(i){ if(i>=workflow.length-1) return; const arr=[...workflow]; const [x]=arr.splice(i,1); arr.splice(i+1,0,x); setWorkflow(arr); }
  function add(){ const v=newRole.trim(); if(!v) return; setWorkflow(w=>[...w, v.toUpperCase()]); setNewRole(""); }
  function remove(i){ setWorkflow(w=>w.filter((_,idx)=>idx!==i)); }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="grid gap-3">
        {workflow.map((r, i)=>(
          <div key={i} className="flex items-center gap-2 border rounded p-2">
            <div className="w-6 opacity-70">{i+1}.</div>
            <div className="font-medium">{r}</div>
            <div className="ml-auto flex gap-2">
              <button className="btn" onClick={()=>up(i)}>Up</button>
              <button className="btn" onClick={()=>down(i)}>Down</button>
              <button className="btn" onClick={()=>remove(i)}>Remove</button>
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <input className="input" value={newRole} onChange={(e)=>setNewRole(e.target.value)} placeholder='Add role (e.g., "L4")' />
          <button className="btn" onClick={add}>Add</button>
        </div>
        <button className="btn-primary" onClick={save}>Save Workflow</button>
        <div className="text-sm opacity-70">
          Note: If the first role is <b>L1</b>, new requests start at the next stage (L2), since L1 is the requester.
        </div>
      </section>

      <section className="text-sm">
        Preview: {workflow.map((r,i)=><span key={i}>{r}{i<workflow.length-1?" → ":""}</span>)}
      </section>
    </div>
  );
}