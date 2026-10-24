import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { Modal } from "../components/Modal";
import {
  FileText,
  Download,
  Eye,
  Search,
  Filter,
  RefreshCw,
  ShieldCheck,
  Lock,
  AlertTriangle,
  FolderLock,
} from "lucide-react";

export function ViewerDashboard() {
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [inspectDoc, setInspectDoc] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, docsData] = await Promise.all([
        api.getViewerStats(),
        api.listDocuments(),
      ]);
      setStats(statsData);
      setDocuments(docsData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownload = async (doc) => {
    setDownloadError("");
    try {
      await api.downloadDocument(doc.id, doc.original_filename);
    } catch (err) {
      setDownloadError(`Access Denied: ${err.message}. If the owner revoked your permission, your access is immediately blocked.`);
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
            Viewer Workspace
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>
            Confidential documents explicitly shared with your verified account
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {downloadError && (
        <div
          style={{
            backgroundColor: "var(--danger-light)",
            border: "1px solid #FECACA",
            borderRadius: "var(--radius-md)",
            padding: "14px 18px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#991B1B",
            fontSize: "14px",
          }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>{downloadError}</div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div className="vault-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--trust-teal)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Accessible Documents</span>
              <FileText size={18} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", marginTop: "8px" }}>{stats.total_accessible_documents}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Active grants active</div>
          </div>

          <div className="vault-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--electric-indigo)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Available Categories</span>
              <FolderLock size={18} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", marginTop: "8px" }}>{stats.categories?.length || 0}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Classified sectors</div>
          </div>

          <div className="vault-card" style={{ padding: "18px 20px", backgroundColor: "var(--soft-lavender)", border: "1px solid var(--soft-lavender-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--electric-indigo)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>Zero Metadata Leakage</span>
              <ShieldCheck size={18} />
            </div>
            <div style={{ fontSize: "13px", fontWeight: "700", marginTop: "8px", color: "var(--midnight-indigo)" }}>
              Strict Least-Privilege
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Unshared documents are completely invisible in queries and counts
            </div>
          </div>
        </div>
      )}

      {/* Accessible Documents Table Card */}
      <div className="vault-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", backgroundColor: "#F8FAFC", display: "flex", gap: "16px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search shared documents..."
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
              <th>Document Title</th>
              <th>Category</th>
              <th>Document Owner</th>
              <th>Permission Level</th>
              <th>File Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  No shared documents available. Only documents explicitly granted to your account by an Owner appear here.
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
                  <td>
                    <div style={{ fontSize: "13px", fontWeight: "600" }}>{doc.owner_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{doc.owner_email}</div>
                  </td>
                  <td>
                    <span className="badge badge-teal">
                      {doc.user_permission || "READ"}
                    </span>
                  </td>
                  <td style={{ fontSize: "13px" }}>{(doc.file_size / 1024).toFixed(1)} KB</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => setInspectDoc(doc)}
                        className="btn btn-secondary"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                        title="View Metadata"
                      >
                        <Eye size={14} /> View Details
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="btn btn-teal"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                        title="Authorized Download"
                      >
                        <Download size={14} /> Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Inspect Document Metadata Modal */}
      <Modal isOpen={!!inspectDoc} onClose={() => setInspectDoc(null)} title={inspectDoc?.title || "Document Details"}>
        {inspectDoc && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px", fontSize: "13px" }}>
              <div>
                <strong>Category:</strong> <span className="badge badge-indigo">{inspectDoc.category}</span>
              </div>
              <div>
                <strong>Permission:</strong> <span className="badge badge-teal">{inspectDoc.user_permission}</span>
              </div>
              <div>
                <strong>Owner:</strong> {inspectDoc.owner_name} ({inspectDoc.owner_email})
              </div>
              <div>
                <strong>File Size:</strong> {(inspectDoc.file_size / 1024).toFixed(1)} KB
              </div>
              <div>
                <strong>Original Name:</strong> {inspectDoc.original_filename}
              </div>
              <div>
                <strong>Upload Date:</strong> {new Date(inspectDoc.created_at).toLocaleDateString()}
              </div>
            </div>

            {inspectDoc.description && (
              <div style={{ marginBottom: "16px", fontSize: "13px" }}>
                <strong>Description:</strong>
                <p style={{ marginTop: "4px", color: "var(--text-muted)" }}>{inspectDoc.description}</p>
              </div>
            )}

            <div style={{ marginBottom: "20px" }}>
              <strong>Cryptographic SHA-256 Checksum:</strong>
              <div className="font-mono" style={{ backgroundColor: "#F8FAFC", padding: "8px 10px", borderRadius: "var(--radius-md)", fontSize: "11px", marginTop: "4px" }}>
                {inspectDoc.file_hash_sha256}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setInspectDoc(null)} className="btn btn-secondary">
                Close
              </button>
              <button
                onClick={() => {
                  handleDownload(inspectDoc);
                  setInspectDoc(null);
                }}
                className="btn btn-teal"
              >
                <Download size={15} /> Download Decrypted File
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
