// App.js
import React, { useEffect, useMemo, useState } from "react";

// ---- Point this to your API
const API_BASE = "https://approval-workflow-api.onrender.com"; // e.g. "https://approval-workflow-api.onrender.com"

function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  });

  function login(email, password) {
    const body = new URLSearchParams({ email, password });
    return fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.detail || "Login failed");
        }
        return r.json();
      })
      .then((data) => {
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(data.user));
        return data;
      });
  }

  function logout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  return { token, user, login, logout, isAuthed: !!token };
}

function App() {
  const { token, user, login, logout, isAuthed } = useAuth();
  const [view, setView] = useState("login");

  useEffect(() => {
    if (!isAuthed) setView("login");
    else {
      // send to a role home
      if (user.role === "L1") setView("l1");
      else if (user.role === "L2") setView("l2");
      else if (user.role === "L3") setView("l3");
      else if (user.role === "L0") setView("l0");
      else if (user.role === "admin") setView("admin");
    }
  }, [isAuthed, user]);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", background: "#0b1220", minHeight: "100vh", color: "white" }}>
      <Header isAuthed={isAuthed} user={user} onNav={setView} onLogout={logout} />
      <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
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

function Header({ isAuthed, user, onNav, onLogout }) {
  return (
    <header style={{ background: "#0e1628", borderBottom: "1px solid #1f2940" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontWeight: 700, letterSpacing: 0.4 }}>Approval Workflow</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          {isAuthed && (
            <>
              {["L1", "L2", "L3", "L0", "admin"].includes(user.role) && (
                <>
                  {user.role !== "L1" && <NavBtn onClick={() => onNav(user.role.toLowerCase())}>{user.role} Home</NavBtn>}
                  {user.role === "L1" && <NavBtn onClick={() => onNav("l1")}>L1 Home</NavBtn>}
                  {user.role === "admin" && <NavBtn onClick={() => onNav("admin")}>Admin</NavBtn>}
                </>
              )}
              <span style={{ opacity: 0.7, alignSelf: "center" }}>{user.email} ({user.role})</span>
              <NavBtn onClick={onLogout}>Logout</NavBtn>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "#18233b", color: "white", border: "1px solid #253155", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}>
      {children}
    </button>
  );
}

function Card({ title, children, footer }) {
  return (
    <div style={{ background: "#0f1729", border: "1px solid #1f2a47", borderRadius: 14, padding: 16 }}>
      {title && <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>}
      <div>{children}</div>
      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
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
    try {
      await onLogin(email, password);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Login">
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" style={inputStyle} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" style={inputStyle} />
        <button disabled={loading} style={btnPrimary} type="submit">{loading ? "Signing in..." : "Sign in"}</button>
        <div style={{ opacity: 0.7, fontSize: 13 }}>
          Tip: use emails like <code>l1@example.com</code>, <code>l2@example.com</code>, <code>l3@example.com</code>, <code>l0@example.com</code>, or <code>admin@example.com</code> to auto-assign roles.
        </div>
      </form>
    </Card>
  );
}

const inputStyle = { background: "#0b1324", color: "white", border: "1px solid #22345e", borderRadius: 8, padding: "10px 12px" };
const btnPrimary = { background: "#2563eb", color: "white", border: "none", borderRadius: 8, padding: "10px 14px", cursor: "pointer" };

/* ---------------------- L1 ---------------------- */

function L1Dashboard({ token, user }) {
  const [mine, setMine] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  async function loadMine() {
    const r = await fetch(`${API_BASE}/api/requests/my-requests`, { headers });
    if (!r.ok) throw new Error("Failed to load requests");
    const data = await r.json();
    setMine(data);
  }

  useEffect(() => {
    loadMine().catch((e) => alert(e.message));
  }, []); // eslint-disable-line

  async function create() {
    try {
      const r = await fetch(`${API_BASE}/api/requests`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title, description, requester_email: user.email }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create");
      }
      setTitle("");
      setDescription("");
      await loadMine();
      alert("✅ Request submitted! It will now appear in the next approver's inbox.");
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Card title="Create Request">
        <div style={{ display: "grid", gap: 10 }}>
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <textarea style={{ ...inputStyle, minHeight: 90 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <button style={btnPrimary} onClick={create}>Submit</button>
        </div>
      </Card>

      <Card title="My Requests">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ opacity: 0.7 }}>
            <tr><th align="left">ID</th><th align="left">Title</th><th align="left">Status</th><th align="left">At</th><th align="left">Updated</th></tr>
          </thead>
          <tbody>
            {mine.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #1c2744" }}>
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.status}</td>
                <td>{Array.isArray(r.workflow_snapshot) && r.workflow_snapshot[r.current_stage] ? r.workflow_snapshot[r.current_stage] : `Stage ${r.current_stage + 1}`}</td>
                <td>{new Date(r.updated_at || r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {mine.length === 0 && (
              <tr><td colSpan="5" style={{ opacity: 0.7, padding: 10 }}>No requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------------- L2/L3 ---------------------- */

function ApproverDashboard({ token, role }) {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  async function load() {
    const r = await fetch(`${API_BASE}/api/requests/pending/${role}`, { headers });
    if (!r.ok) throw new Error("Failed to load inbox");
    const data = await r.json();
    setRequests(data);
    setSelected(data[0] || null);
  }

  useEffect(() => {
    load().catch((e) => alert(e.message));
    // eslint-disable-next-line
  }, [role]);

  async function act(requestId, action) {
    try {
      const r = await fetch(`${API_BASE}/api/requests/${requestId}/action`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action, comment }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to ${action}`);
      }
      await load();
      setComment("");
      alert(`${action === "approve" ? "✅ Approved" : "❌ Rejected"} #${requestId}${comment ? `\nNote: ${comment}` : ""}`);
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1.1fr 0.9fr" }}>
      <Card title={`${role} Inbox`}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ opacity: 0.7 }}>
            <tr><th align="left">ID</th><th align="left">Title</th><th align="left">Requester</th><th align="left">Stage</th><th align="left">Updated</th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} onClick={() => setSelected(r)} style={{ borderTop: "1px solid #1c2744", cursor: "pointer" }}>
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.requester_email}</td>
                <td>{Array.isArray(r.workflow_snapshot) && r.workflow_snapshot[r.current_stage] ? r.workflow_snapshot[r.current_stage] : `Stage ${r.current_stage + 1}`}</td>
                <td>{new Date(r.updated_at || r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan="5" style={{ opacity: 0.7, padding: 10 }}>No pending items.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Details">
        {!selected && <div style={{ opacity: 0.7 }}>Select a request from the left.</div>}
        {selected && (
          <div style={{ display: "grid", gap: 10 }}>
            <div><b>#{selected.id}</b> — {selected.title}</div>
            <div style={{ opacity: 0.8 }}>{selected.description}</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>Requester: {selected.requester_email}</div>
            <div>
              <span style={{ padding: "4px 8px", background: "#3b2760", borderRadius: 999 }}>
                {selected.workflow_snapshot?.[selected.current_stage] ? `Waiting: ${selected.workflow_snapshot[selected.current_stage]}` : `Stage ${selected.current_stage + 1}`}
              </span>
            </div>
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...btnPrimary, background: "#16a34a" }} onClick={() => act(selected.id, "approve")}>Approve</button>
              <button style={{ ...btnPrimary, background: "#dc2626" }} onClick={() => act(selected.id, "reject")}>Reject</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------- L0 ---------------------- */

function L0Dashboard({ token }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [summary, setSummary] = useState({ total: 0, approved: 0, rejected: 0, pending: 0, changes_requested: 0 });
  const [recent, setRecent] = useState([]);

  async function load() {
    const r = await fetch(`${API_BASE}/api/dashboard`, { headers });
    if (!r.ok) throw new Error("Failed to load dashboard");
    const data = await r.json();
    setSummary(data.summary);
    setRecent(data.recent);
  }
  useEffect(() => { load().catch((e) => alert(e.message)); }, []); // eslint-disable-line

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <Stat title="Total" value={summary.total} />
        <Stat title="Pending" value={summary.pending} />
        <Stat title="Approved" value={summary.approved} />
        <Stat title="Changes Requested" value={summary.changes_requested} />
      </div>

      <Card title="Recent">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ opacity: 0.7 }}>
            <tr><th align="left">ID</th><th align="left">Title</th><th align="left">Status</th><th align="left">At</th><th align="left">Updated</th></tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #1c2744" }}>
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.status}</td>
                <td>{r.status === "approved" ? "Completed" : r.workflow_snapshot?.[r.current_stage] ? `At ${r.workflow_snapshot[r.current_stage]}` : `Stage ${r.current_stage + 1}`}</td>
                <td>{new Date(r.updated_at || r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan="5" style={{ opacity: 0.7, padding: 10 }}>No activity.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div style={{ background: "#0f1729", border: "1px solid #1f2a47", borderRadius: 14, padding: 16 }}>
      <div style={{ opacity: 0.7, fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

/* ---------------------- Admin ---------------------- */

function AdminDashboard({ token }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [workflow, setWorkflow] = useState(["L1", "L2", "L3"]);
  const [newRole, setNewRole] = useState("");

  async function load() {
    const r = await fetch(`${API_BASE}/api/workflow`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data.workflow_order)) setWorkflow(data.workflow_order);
    }
  }
  useEffect(() => { load().catch(() => {}); }, []); // eslint-disable-line

  async function save() {
    const r = await fetch(`${API_BASE}/api/workflow`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ workflow_order: workflow }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(err.detail || "Failed to save workflow");
      return;
    }
    const data = await r.json();
    setWorkflow(data.workflow_order || workflow);
    alert("✅ Workflow saved. New requests will follow: " + (data.workflow_order || workflow).join(" → "));
  }

  function moveUp(idx) {
    if (idx <= 0) return;
    const next = workflow.slice();
    const [a] = next.splice(idx, 1);
    next.splice(idx - 1, 0, a);
    setWorkflow(next);
  }
  function moveDown(idx) {
    if (idx >= workflow.length - 1) return;
    const next = workflow.slice();
    const [a] = next.splice(idx, 1);
    next.splice(idx + 1, 0, a);
    setWorkflow(next);
  }
  function addRole() {
    const v = newRole.trim();
    if (!v) return;
    setWorkflow((w) => [...w, v.toUpperCase()]);
    setNewRole("");
  }
  function remove(idx) {
    setWorkflow((w) => w.filter((_, i) => i !== idx));
  }

  return (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr 1fr" }}>
      <Card title="Workflow Editor">
        <div style={{ display: "grid", gap: 10 }}>
          {workflow.map((r, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, background: "#101a31", border: "1px solid #1a2a4d", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ width: 34, opacity: 0.7 }}>{idx + 1}.</div>
              <div style={{ fontWeight: 600 }}>{r}</div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button style={tinyBtn} onClick={() => moveUp(idx)}>↑</button>
                <button style={tinyBtn} onClick={() => moveDown(idx)}>↓</button>
                <button style={{ ...tinyBtn, background: "#dc2626" }} onClick={() => remove(idx)}>✕</button>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 10 }}>
            <input style={{ ...inputStyle, flex: 1 }} value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder='Add role (e.g., "L4")' />
            <button style={btnPrimary} onClick={addRole}>Add</button>
          </div>
          <div><button style={btnPrimary} onClick={save}>Save Workflow</button></div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            Note: If the first role is <b>L1</b>, new requests start at the <b>next</b> stage (L2), since L1 is the requester and does not approve their own request. Existing requests keep a snapshot of the workflow they started with.
          </div>
        </div>
      </Card>

      <Card title="Preview">
        <div style={{ fontSize: 15, opacity: 0.8 }}>
          {workflow.map((r, i) => (
            <span key={i}>
              {r}{i < workflow.length - 1 ? " → " : ""}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

const tinyBtn = { background: "#1f2a48", color: "white", border: "1px solid #2a3a66", borderRadius: 8, padding: "6px 8px", cursor: "pointer" };

export default App;
