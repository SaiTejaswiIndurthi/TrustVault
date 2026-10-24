import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { Modal } from "../components/Modal";
import {
  FileText,
  Share2,
  Lock,
  Upload,
  Download,
  Trash2,
  Edit,
  History,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  XCircle,
} from "lucide-react";

export function OwnerDashboard() {
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocForPerms, setSelectedDocForPerms] = useState(null);
  const [docPermissions, setDocPermissions] = useState([]);
  const [selectedDocForActivity, setSelectedDocForActivity] = useState(null);
  const [docActivity, setDocActivity] = useState([]);
  const [editDoc, setEditDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);

  // Upload Form state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Confidential");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Grant Form state
  const [grantUserId, setGrantUserId] = useState("");
  const [grantLevel, setGrantLevel] = useState("READ");
  const [granting, setGranting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, docsData, usersData] = await Promise.all([
        api.getOwnerStats(),
        api.listDocuments(),
        api.listShareableUsers(),
      ]);
      setStats(statsData);
      setDocuments(docsData || []);
      setActiveUsers(usersData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploadError("");
    if (!uploadFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", uploadTitle);
      formData.append("category", uploadCategory);
      if (uploadDesc) formData.append("description", uploadDesc);
      formData.append("file", uploadFile);

      await api.uploadDocument(formData);
      setIsUploadOpen(false);
      setUploadTitle("");
      setUploadDesc("");
      setUploadFile(null);
      fetchData();
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const openPermissionModal = async (doc) => {
    setSelectedDocForPerms(doc);
    try {
      const perms = await api.getDocumentPermissions(doc.id);
      setDocPermissions(perms || []);
    } catch (e) {
      alert("Failed to load permissions: " + e.message);
    }
  };

  const handleGrantPermission = async (e) => {
    e.preventDefault();
    if (!grantUserId) return;
    setGranting(true);
    try {
      await api.grantPermission(selectedDocForPerms.id, {
        user_id: grantUserId,
        permission_level: grantLevel,
      });
      const perms = await api.getDocumentPermissions(selectedDocForPerms.id);
      setDocPermissions(perms || []);
      setGrantUserId("");
      fetchData();
    } catch (err) {
      alert(err.message || "Failed to grant permission.");
    } finally {
      setGranting(false);
    }
  };

  const handleRevokePermission = async (permId) => {
    if (!confirm("Are you sure you want to immediately revoke access for this user?")) return;
    try {
      await api.revokePermission(permId, { reason: "Revoked by document owner" });
      const perms = await api.getDocumentPermissions(selectedDocForPerms.id);
      setDocPermissions(perms || []);
      fetchData();
    } catch (err) {
      alert("Failed to revoke: " + err.message);
    }
  };

  const openActivityModal = async (doc) => {
    setSelectedDocForActivity(doc);
    try {
      const act = await api.getDocumentActivity(doc.id);
      setDocActivity(act || []);
    } catch (e) {
      alert("Failed to load activity: " + e.message);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.updateDocumentMetadata(editDoc.id, {
        title: editDoc.title,
        description: editDoc.description,
        category: editDoc.category,
      });
      setEditDoc(null);
      fetchData();
    } catch (err) {
      alert("Failed to update metadata: " + err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.deleteDocument(deleteDoc.id);
      setDeleteDoc(null);
      fetchData();
    } catch (err) {
      alert("Failed to delete document: " + err.message);
    }
  };

  const handleDownload = async (doc) => {
    try {
      await api.downloadDocument(doc.id, doc.original_filename);
    } catch (err) {
      alert("Download error: " + err.message);
    }
  };

  const filteredDocs = documents.filter((d) => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.original_filename.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !categoryFilter || d.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--midnight-indigo)" }}>
            Document Owner Workspace
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>
            Upload confidential assets, grant granular permissions, and track document access history
          </p>
        </div>
        <button
          onClick={() => setIsUploadOpen(true)}
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Plus size={16} />
          <span>Upload Confidential Document</span>
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div className="vault-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--electric-indigo)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Owned Documents</span>
              <FileText size={18} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", marginTop: "8px" }}>{stats.total_owned_documents}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Private storage confined</div>
          </div>

          <div className="vault-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--trust-teal)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Shared Documents</span>
              <Share2 size={18} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", marginTop: "8px" }}>{stats.shared_documents_count}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Active grants active</div>
          </div>

          <div className="vault-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--amber)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Active Permissions</span>
              <Users size={18} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", marginTop: "8px" }}>{stats.active_permission_grants}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Revocable instantly</div>
          </div>
        </div>
      )}

      {/* Document Inventory Table Card */}
      <div className="vault-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", backgroundColor: "#F8FAFC", display: "flex", gap: "16px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search owned documents by title or filename..."
              className="input-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "36px" }}
            />
          </div>
          <select
            className="input-control"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: "180px" }}
          >
            <option value="">All Categories</option>
            {stats?.categories?.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <table className="vault-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Category</th>
              <th>File Size</th>
              <th>Uploaded Date</th>
              <th>SHA-256 Hash</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  No documents found. Click "Upload Confidential Document" to get started.
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ fontWeight: "700", color: "var(--midnight-indigo)" }}>{doc.title}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{doc.original_filename}</div>
                  </td>
                  <td>
                    <span className="badge badge-indigo">{doc.category}</span>
                  </td>
                  <td style={{ fontSize: "13px" }}>{(doc.file_size / 1024).toFixed(1)} KB</td>
                  <td style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <span
                      className="font-mono"
                      style={{ fontSize: "11px", backgroundColor: "#F1F5F9", padding: "3px 6px", borderRadius: "4px" }}
                      title={doc.file_hash_sha256}
                    >
                      {doc.file_hash_sha256.substring(0, 14)}...
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="btn btn-secondary"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                        title="Download Document Stream"
                      >
                        <Download size={14} /> Download
                      </button>
                      <button
                        onClick={() => openPermissionModal(doc)}
                        className="btn btn-secondary"
                        style={{ padding: "5px 10px", fontSize: "12px", color: "var(--electric-indigo)" }}
                        title="Manage Permissions & Shares"
                      >
                        <Share2 size={14} /> Permissions
                      </button>
                      <button
                        onClick={() => openActivityModal(doc)}
                        className="btn btn-secondary"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                        title="View Document Activity History"
                      >
                        <History size={14} />
                      </button>
                      <button
                        onClick={() => setEditDoc(doc)}
                        className="btn btn-secondary"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                        title="Edit Metadata"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteDoc(doc)}
                        className="btn btn-outline-danger"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                        title="Delete Document"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Upload Confidential Document">
        <form onSubmit={handleUploadSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {uploadError && (
            <div style={{ backgroundColor: "var(--danger-light)", padding: "10px", borderRadius: "var(--radius-md)", color: "#991B1B", fontSize: "13px" }}>
              {uploadError}
            </div>
          )}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Document Title</label>
            <input
              type="text"
              required
              className="input-control"
              placeholder="e.g. Q4 Financial Strategy & Key Distribution"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Category</label>
              <select
                className="input-control"
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
              >
                <option value="Confidential">Confidential</option>
                <option value="Finance">Finance</option>
                <option value="Engineering">Engineering</option>
                <option value="Legal">Legal</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Select File</label>
              <input
                type="file"
                required
                className="input-control"
                onChange={(e) => setUploadFile(e.target.files[0])}
                style={{ fontSize: "12px" }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Description (Optional)</label>
            <textarea
              className="input-control"
              rows={2}
              placeholder="Brief context regarding document sensitivity"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
            />
          </div>

          <div style={{ padding: "12px", backgroundColor: "var(--soft-lavender)", borderRadius: "var(--radius-md)", fontSize: "12px", color: "var(--midnight-indigo)" }}>
            <div style={{ fontWeight: "700" }}>Zero-Trust Storage Protection:</div>
            File will be assigned a random server-generated key and encrypted/stored strictly outside the public web root. Signature bytes are strictly validated.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={() => setIsUploadOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={uploading} className="btn btn-primary">
              {uploading ? "Encrypting & Storing..." : "Upload to Vault"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Permissions Management Modal */}
      <Modal
        isOpen={!!selectedDocForPerms}
        onClose={() => setSelectedDocForPerms(null)}
        title={`Access Permissions &bull; ${selectedDocForPerms?.title}`}
        maxWidth="680px"
      >
        <div>
          {/* Grant New Permission Section */}
          <div style={{ backgroundColor: "#F8FAFC", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", marginBottom: "20px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "10px", color: "var(--midnight-indigo)" }}>
              Grant New Access Permission
            </h4>
            <form onSubmit={handleGrantPermission} style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Select Active User</label>
                <select
                  required
                  className="input-control"
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                >
                  <option value="">Choose an active user...</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email}) &bull; {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ width: "120px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Access Level</label>
                <select
                  className="input-control"
                  value={grantLevel}
                  onChange={(e) => setGrantLevel(e.target.value)}
                >
                  <option value="READ">READ</option>
                  <option value="EDIT">EDIT</option>
                </select>
              </div>

              <button type="submit" disabled={granting || !grantUserId} className="btn btn-teal" style={{ padding: "10px 16px" }}>
                {granting ? "Granting..." : "Grant"}
              </button>
            </form>
          </div>

          {/* Active Grants List */}
          <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "var(--midnight-indigo)" }}>
            Current &amp; Historical Permissions
          </h4>
          <table className="vault-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Level</th>
                <th>Status</th>
                <th>Granted At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {docPermissions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                    No permissions granted yet. This document is strictly private to you.
                  </td>
                </tr>
              ) : (
                docPermissions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: "600", fontSize: "13px" }}>{p.user_name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{p.user_email}</div>
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: p.permission_level === "EDIT" ? "var(--amber-light)" : "var(--soft-lavender)", color: p.permission_level === "EDIT" ? "var(--amber)" : "var(--electric-indigo)" }}>
                        {p.permission_level}
                      </span>
                    </td>
                    <td>
                      {p.is_active ? (
                        <span className="badge badge-active">Active</span>
                      ) : (
                        <span className="badge badge-danger">Revoked</span>
                      )}
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {new Date(p.granted_at).toLocaleDateString()}
                    </td>
                    <td>
                      {p.is_active && (
                        <button
                          onClick={() => handleRevokePermission(p.id)}
                          className="btn btn-outline-danger"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                        >
                          Revoke Immediately
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Document Activity Timeline Modal */}
      <Modal
        isOpen={!!selectedDocForActivity}
        onClose={() => setSelectedDocForActivity(null)}
        title={`Audit History &bull; ${selectedDocForActivity?.title}`}
      >
        <div style={{ maxHeight: "350px", overflowY: "auto" }}>
          {docActivity.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
              No audit records recorded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {docActivity.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid var(--border-color)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span className="badge" style={{ backgroundColor: "#F1F5F9", color: "var(--midnight-indigo)" }}>
                      {ev.action}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px" }}>
                      by {ev.actor_email}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {new Date(ev.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Metadata Modal */}
      <Modal isOpen={!!editDoc} onClose={() => setEditDoc(null)} title="Edit Document Metadata">
        {editDoc && (
          <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Title</label>
              <input
                type="text"
                required
                className="input-control"
                value={editDoc.title}
                onChange={(e) => setEditDoc({ ...editDoc, title: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Category</label>
              <input
                type="text"
                required
                className="input-control"
                value={editDoc.category}
                onChange={(e) => setEditDoc({ ...editDoc, category: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Description</label>
              <textarea
                className="input-control"
                rows={3}
                value={editDoc.description || ""}
                onChange={(e) => setEditDoc({ ...editDoc, description: e.target.value })}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => setEditDoc(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteDoc} onClose={() => setDeleteDoc(null)} title="Delete Document">
        <div>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "20px" }}>
            Are you sure you want to permanently delete document <strong>{deleteDoc?.title}</strong>? The file
            will be securely unlinked from private vault storage and the action logged in the tamper-evident audit trail.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button onClick={() => setDeleteDoc(null)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleDeleteConfirm} className="btn btn-danger">
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
