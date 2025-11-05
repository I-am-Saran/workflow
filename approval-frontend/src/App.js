import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, XCircle, Eye, LogOut, Plus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

const API_BASE = 'https://approval-workflow-api.onrender.com';

const GlassCard = ({ children, className = '' }) => (
  <div className={`backdrop-blur-lg bg-white/10 rounded-2xl border border-white/20 shadow-2xl ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', disabled, type }) => {
  const variants = {
    primary: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700',
    success: 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700',
    danger: 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700',
    secondary: 'bg-white/20 hover:bg-white/30 border border-white/30'
  };
  return (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="mb-4">
    <label className="block text-white/90 mb-2 font-medium">{label}</label>
    <input
      {...props}
      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
    />
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div className="mb-4">
    <label className="block text-white/90 mb-2 font-medium">{label}</label>
    <textarea
      {...props}
      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none"
      rows="4"
    />
  </div>
);

/* ---------------- Login ---------------- */
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
    alert("Please enter both email and password");
    return;
    }
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email, password }),
      });
      if (!res.ok) {
        const error = await res.json().catch(()=>({}));
        alert(error.detail || 'Login failed');
        return;
      }
      const data = await res.json();
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      onLogin(data.user, data.token);
    } catch {
      alert('Unable to connect to API');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">Approval Workflow</h2>
        <form onSubmit={handleSubmit}>
          <Input label="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="your@email.com" />
          <Input label="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter any password" />
          <Button className="w-full mt-4" type="submit">Sign In</Button>
        </form>
      </div>
    </div>
  );
};

/* ---------------- L1 ---------------- */
const L1Dashboard = ({ user, token }) => {
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchRequests().catch(()=>{});
  }, []); // eslint-disable-next-line

  const fetchRequests = async () => {
    const res = await fetch(`${API_BASE}/api/requests/my-requests`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to fetch requests');
    setRequests(await res.json());
  };

  const createRequest = async () => {
    if (!title || !description) { alert('Please fill all fields'); return; }
    const res = await fetch(`${API_BASE}/api/requests`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, requester_email: user.email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      alert(err.detail || 'Failed to create request');
      return;
    }
    const data = await res.json();
    setRequests([data, ...requests]);
    setTitle(''); setDescription(''); setShowForm(false);
    alert('Request created successfully!');
  };

  const getStageInfo = (req) => {
    const workflow = req.workflow_snapshot || ['L1','L2','L3'];
    if (req.status === 'approved') return 'Completed';
    if (req.status === 'rejected') return 'Rejected';
    if (req.current_stage < workflow.length) return `At ${workflow[req.current_stage]}`;
    return 'In Progress';
    };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">My Requests</h2>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
          <Plus className="w-5 h-5" /> New Request
        </Button>
      </div>

      {showForm && (
        <GlassCard className="p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Create New Request</h3>
          <Input label="Title" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Request title" />
          <Textarea label="Description" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Describe your request..." />
          <div className="flex gap-3">
            <Button onClick={createRequest}>Submit</Button>
            <Button onClick={()=>setShowForm(false)} variant="secondary">Cancel</Button>
          </div>
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">ID</th>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">Title</th>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">Description</th>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">Stage</th>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-white">{req.id}</td>
                  <td className="px-6 py-4 text-white font-medium">{req.title}</td>
                  <td className="px-6 py-4 text-white/70">{req.description}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      req.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                      req.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>{req.status}</span>
                  </td>
                  <td className="px-6 py-4 text-white">{getStageInfo(req)}</td>
                  <td className="px-6 py-4 text-white/70">{req.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

/* ---------------- L2/L3 (with inline Approve/Reject) ---------------- */
const ApproverDashboard = ({ user, token }) => {
  const [requests, setRequests] = useState([]);
  const [commentMap, setCommentMap] = useState({}); // { [id]: string }

  useEffect(() => {
    fetchPendingRequests().catch(()=>{});
  }, []); // eslint-disable-next-line

  const fetchPendingRequests = async () => {
    const response = await fetch(`${API_BASE}/api/requests/pending/${user.role}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to load requests');
    const data = await response.json();
    setRequests(data);
  };

  const setComment = (id, value) => {
    setCommentMap((m) => ({ ...m, [id]: value }));
  };

  const handleAction = async (requestId, action) => {
    const comment = commentMap[requestId] || '';
    const res = await fetch(`${API_BASE}/api/requests/${requestId}/action`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, comment }),
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      alert(err.detail || `Failed to ${action}`);
      return;
    }
    alert(`${action === 'approve' ? '✅ Approved' : '❌ Rejected'} #${requestId}${comment ? `\nComment: ${comment}` : ''}`);
    setCommentMap((m) => ({ ...m, [requestId]: '' }));
    await fetchPendingRequests();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Pending Approvals ({user.role})</h2>
        <div className="px-4 py-2 bg-white/10 rounded-xl">
          <span className="text-white/70 text-sm">Pending: </span>
          <span className="text-white font-bold text-lg">{requests.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {requests.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">All Caught Up! 🎉</h3>
            <p className="text-white/70">No pending approvals at this time</p>
          </GlassCard>
        ) : (
          requests.map((req) => (
            <GlassCard key={req.id} className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-semibold text-white">{req.title}</h3>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold">#{req.id}</span>
              </div>
              <p className="text-white/70 mb-4">{req.description}</p>

              <div className="grid gap-2 text-sm mb-4">
                <div className="text-white/60">From: {req.requester_email}</div>
                <div>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full">
                    Stage {req.current_stage + 1}
                  </span>
                </div>
              </div>

              <Textarea
                label="Comment (optional)"
                value={commentMap[req.id] || ''}
                onChange={(e) => setComment(req.id, e.target.value)}
                placeholder="Add your comments or feedback..."
              />

              <div className="flex gap-3">
                <Button
                  onClick={() => handleAction(req.id, 'approve')}
                  variant="success"
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Approve
                </Button>
                <Button
                  onClick={() => handleAction(req.id, 'reject')}
                  variant="danger"
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Reject
                </Button>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
};

/* ---------------- Admin ---------------- */
const AdminDashboard = ({ user, token }) => {
  const [workflow, setWorkflow] = useState(['L1', 'L2', 'L3']);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/workflow`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.workflow_order)) setWorkflow(data.workflow_order);
        }
      } catch {}
    })();
  }, []); // eslint-disable-next-line

  const moveUp = (index) => {
    if (index > 0) {
      const newWorkflow = [...workflow];
      [newWorkflow[index], newWorkflow[index - 1]] = [newWorkflow[index - 1], newWorkflow[index]];
      setWorkflow(newWorkflow);
    }
  };
  const moveDown = (index) => {
    if (index < workflow.length - 1) {
      const newWorkflow = [...workflow];
      [newWorkflow[index], newWorkflow[index + 1]] = [newWorkflow[index + 1], newWorkflow[index]];
      setWorkflow(newWorkflow);
    }
  };
  const removeStage = (index) => {
    if (workflow.length <= 1) { alert('Cannot remove the last stage'); return; }
    setWorkflow(workflow.filter((_, i) => i !== index));
  };
  const addStage = () => {
    const role = prompt('Enter role (L1, L2, or L3):');
    if (role && ['L1','L2','L3'].includes(role.toUpperCase())) {
      setWorkflow([...workflow, role.toUpperCase()]);
    } else if (role) {
      alert('Invalid role. Please enter L1, L2, or L3');
    }
  };
  const saveWorkflow = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workflow`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_order: workflow })
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.detail || 'Failed to save workflow');
      }
      const data = await res.json();
      setWorkflow(data.workflow_order || workflow);
      alert('✅ Workflow saved successfully!\n\nNew workflow: ' + (data.workflow_order || workflow).join(' → ') + '\n\nThis will apply to all new requests.');
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white">Workflow Configuration</h2>

      <GlassCard className="p-6">
        <h3 className="text-xl font-semibold text-white mb-2">Approval Flow Order</h3>
        <p className="text-white/70 mb-6">Configure the order of approval stages. New requests will follow this workflow.</p>
        <div className="space-y-3 mb-6">
          {workflow.map((role, index) => (
            <div key={index} className="flex items-center gap-3 bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-all">
              <div className="flex-1 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold">{index + 1}</span>
                </div>
                <span className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white font-semibold">{role}</span>
                {index < workflow.length - 1 && <span className="text-white/50 ml-2">→</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>moveUp(index)} disabled={index===0} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
                  <ArrowUp className="w-5 h-5 text-white" />
                </button>
                <button onClick={()=>moveDown(index)} disabled={index===workflow.length-1} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
                  <ArrowDown className="w-5 h-5 text-white" />
                </button>
                <button onClick={()=>removeStage(index)} disabled={workflow.length<=1} className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Remove stage">
                  <Trash2 className="w-5 h-5 text-red-300" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button onClick={addStage} variant="secondary" className="flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add Stage
          </Button>
          <Button onClick={saveWorkflow}>💾 Save Workflow</Button>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Current Workflow Preview</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {workflow.map((role, index) => (
            <React.Fragment key={index}>
              <div className="px-5 py-3 bg-white/10 rounded-lg text-white font-semibold border border-white/20">{role}</div>
              {index < workflow.length - 1 && <span className="text-white/50 text-2xl">→</span>}
            </React.Fragment>
          ))}
        </div>
        <p className="text-white/60 text-sm mt-4">ℹ️ Existing requests continue with their original workflow. Only new requests will use this flow.</p>
      </GlassCard>
    </div>
  );
};

/* ---------------- L0 ---------------- */
const L0Dashboard = ({ user, token }) => {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ total:0, pending:0, approved:0, rejected:0 });

  useEffect(() => {
    fetchDashboard().catch(()=>{});
  }, []); // eslint-disable-next-line

  const fetchDashboard = async () => {
    const res = await fetch(`${API_BASE}/api/dashboard`, { headers: { "Authorization": `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to fetch dashboard data');
    const data = await res.json();
    setRequests(data.requests || []);
    setStats({ total: data.total || 0, pending: data.pending || 0, approved: data.approved || 0, rejected: data.rejected || 0 });
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-bold text-white flex items-center gap-3"><Eye className="w-8 h-8" /> Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-6"><div className="text-white/70 mb-2 text-sm">Total Requests</div><div className="text-4xl font-bold text-white">{stats.total}</div></GlassCard>
        <GlassCard className="p-6"><div className="text-white/70 mb-2 text-sm">Pending</div><div className="text-4xl font-bold text-yellow-300">{stats.pending}</div></GlassCard>
        <GlassCard className="p-6"><div className="text-white/70 mb-2 text-sm">Approved</div><div className="text-4xl font-bold text-green-300">{stats.approved}</div></GlassCard>
        <GlassCard className="p-6"><div className="text-white/70 mb-2 text-sm">Rejected</div><div className="text-4xl font-bold text-red-300">{stats.rejected}</div></GlassCard>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="p-4 bg-white/5 border-b border-white/10"><h3 className="text-lg font-semibold text-white">All Requests</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">ID</th>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">Title</th>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">Requester</th>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">Stage</th>
                <th className="px-6 py-4 text-left text-white/90 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-white font-semibold">#{req.id}</td>
                  <td className="px-6 py-4 text-white">{req.title}</td>
                  <td className="px-6 py-4 text-white/70">{req.requester_email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      req.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                      req.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>{(req.status || '').toUpperCase()}</span>
                  </td>
                  <td className="px-6 py-4 text-white">{req.status === 'approved' ? 'Completed' : req.status === 'rejected' ? 'Stopped' : `Stage ${req.current_stage}`}</td>
                  <td className="px-6 py-4 text-white/70">{req.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

/* ---------------- App shell ---------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
  }, []);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {!user ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <>
          <nav className="backdrop-blur-lg bg-white/10 border-b border-white/20 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">Approval System</h1>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-white font-semibold">{user.name}</div>
                  <div className="text-white/70 text-sm">{user.role}</div>
                </div>
                <Button onClick={handleLogout} variant="secondary" className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            </div>
          </nav>

          <div className="max-w-7xl mx-auto">
            {user.role === 'L1' && <L1Dashboard user={user} token={token} />}
            {(user.role === 'L2' || user.role === 'L3') && <ApproverDashboard user={user} token={token} />}
            {user.role === 'admin' && <AdminDashboard user={user} token={token} />}
            {user.role === 'L0' && <L0Dashboard user={user} token={token} />}
          </div>
        </>
      )}
    </div>
  );
}
