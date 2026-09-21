const { useState, useEffect } = React;

function CreateProjectWizard() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: ND Setup
    projectNumber: '',
    projectName: '',
    client: '',
    workstream: '',
    projectManager: '',
    week1Ending: '',
    numWeeks: 16,
    statusDate: '',
    sowValue: '',
    billingType: 'Fixed Price',
    // Step 2: Resources
    resources: [],
    // Step 3: Baseline
    baselineFile: null,
  });
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const pmEmail = localStorage.getItem('pmEmail');

  const updateFormData = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const addResource = () => {
    setFormData(prev => ({
      ...prev,
      resources: [...prev.resources, { key: '', name: '', role: '', country: '', hourlyCost: '', billRate: '', baselineHrs: '' }],
    }));
  };

  const updateResource = (index, field, value) => {
    const updated = [...formData.resources];
    updated[index][field] = value;
    setFormData(prev => ({ ...prev, resources: updated }));
  };

  const removeResource = (index) => {
    setFormData(prev => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const payload = new FormData();
      payload.append('data', JSON.stringify({
        setup: {
          projectNumber: formData.projectNumber,
          projectName: formData.projectName,
          client: formData.client,
          workstream: formData.workstream,
          projectManager: formData.projectManager,
          week1Ending: formData.week1Ending,
          numWeeks: parseInt(formData.numWeeks),
          statusDate: formData.statusDate,
          sowValue: parseFloat(formData.sowValue),
          billingType: formData.billingType,
        },
        resources: formData.resources.map(r => ({
          key: r.key,
          displayName: r.name,
          role: r.role,
          country: r.country,
          hourlyCost: parseFloat(r.hourlyCost),
          billRate: parseFloat(r.billRate),
          baselineSowHrs: parseFloat(r.baselineHrs),
        })),
      }));

      if (formData.baselineFile) {
        payload.append('baseline', formData.baselineFile);
      }

      const res = await fetch('/api/projects/generate', {
        method: 'POST',
        headers: { 'x-pm-email': pmEmail },
        body: payload,
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Project created! Redirecting...' });
        setTimeout(() => {
          window.location.hash = `#/projects/${data.projectId}`;
        }, 1000);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => window.location.hash = '#/'}
          style={{
            background: '#8d99ae',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '12px',
          }}
        >
          ← Back
        </button>
        <h2 style={{ display: 'inline' }}>Create New Project</h2>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                background: step >= s ? '#1e2761' : '#e0e0e0',
                color: step >= s ? 'white' : '#666',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              Step {s}
            </div>
          ))}
        </div>

        {message && (
          <div className={message.type === 'success' ? 'success' : 'error'} style={{ marginBottom: '16px' }}>
            {message.text}
          </div>
        )}

        {/* STEP 1: Project Setup */}
        {step === 1 && (
          <div>
            <h3>Project Setup</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <input
                type="text"
                placeholder="Project Number (e.g., CD 0358154.01)"
                value={formData.projectNumber}
                onChange={(e) => updateFormData('projectNumber', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input
                type="text"
                placeholder="Project Name"
                value={formData.projectName}
                onChange={(e) => updateFormData('projectName', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input
                type="text"
                placeholder="Client"
                value={formData.client}
                onChange={(e) => updateFormData('client', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input
                type="text"
                placeholder="Workstream"
                value={formData.workstream}
                onChange={(e) => updateFormData('workstream', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input
                type="text"
                placeholder="Project Manager Email"
                value={formData.projectManager}
                onChange={(e) => updateFormData('projectManager', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <input
                  type="date"
                  placeholder="Week 1 Ending Date"
                  value={formData.week1Ending}
                  onChange={(e) => updateFormData('week1Ending', e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <input
                  type="number"
                  placeholder="Number of Weeks"
                  value={formData.numWeeks}
                  onChange={(e) => updateFormData('numWeeks', e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <input
                type="date"
                placeholder="Status Date"
                value={formData.statusDate}
                onChange={(e) => updateFormData('statusDate', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input
                type="number"
                placeholder="SOW Value ($)"
                value={formData.sowValue}
                onChange={(e) => updateFormData('sowValue', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <select
                value={formData.billingType}
                onChange={(e) => updateFormData('billingType', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option>Fixed Price</option>
                <option>Time & Materials</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 2: Resources & Rates */}
        {step === 2 && (
          <div>
            <h3>Resources & Rates</h3>
            <div style={{ marginBottom: '12px' }}>
              <button
                className="upload-button"
                onClick={addResource}
                style={{ fontSize: '13px', padding: '6px 12px' }}
              >
                + Add Resource
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f4f6fb' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Resource Key</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Name</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Role</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Cost/hr</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Bill Rate</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Baseline Hrs</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.resources.map((res, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="text"
                          value={res.key}
                          onChange={(e) => updateResource(i, 'key', e.target.value)}
                          style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ddd' }}
                          placeholder="63064702"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="text"
                          value={res.name}
                          onChange={(e) => updateResource(i, 'name', e.target.value)}
                          style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ddd' }}
                          placeholder="Steve Chow"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="text"
                          value={res.role}
                          onChange={(e) => updateResource(i, 'role', e.target.value)}
                          style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ddd' }}
                          placeholder="Business Analyst"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          value={res.hourlyCost}
                          onChange={(e) => updateResource(i, 'hourlyCost', e.target.value)}
                          style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ddd' }}
                          placeholder="87"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          value={res.billRate}
                          onChange={(e) => updateResource(i, 'billRate', e.target.value)}
                          style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ddd' }}
                          placeholder="176.56"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          value={res.baselineHrs}
                          onChange={(e) => updateResource(i, 'baselineHrs', e.target.value)}
                          style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ddd' }}
                          placeholder="176"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button
                          onClick={() => removeResource(i)}
                          style={{
                            background: '#c0392b',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: Baseline Hours */}
        {step === 3 && (
          <div>
            <h3>Baseline Hours</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
              Upload the CSV export from your project plan (Hours by Resource, Resource, and Role)
            </p>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => updateFormData('baselineFile', e.target.files?.[0])}
              style={{
                padding: '12px',
                borderRadius: '4px',
                border: '2px dashed #cadcfc',
                width: '100%',
              }}
            />
            {formData.baselineFile && (
              <p style={{ fontSize: '12px', color: '#27ae60', marginTop: '8px' }}>
                ✓ {formData.baselineFile.name}
              </p>
            )}
          </div>
        )}

        {/* STEP 4: Review */}
        {step === 4 && (
          <div>
            <h3>Review & Create</h3>
            <div style={{ background: '#f4f6fb', padding: '12px', borderRadius: '4px', fontSize: '13px' }}>
              <p><strong>Project:</strong> {formData.projectName} ({formData.client})</p>
              <p><strong>Manager:</strong> {formData.projectManager}</p>
              <p><strong>SOW Value:</strong> ${parseFloat(formData.sowValue || 0).toLocaleString()}</p>
              <p><strong>Resources:</strong> {formData.resources.length} added</p>
              <p><strong>Baseline Hours:</strong> {formData.baselineFile ? formData.baselineFile.name : 'Not uploaded'}</p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                background: '#8d99ae',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ← Previous
            </button>
          )}
          {step < 4 && (
            <button
              onClick={() => setStep(step + 1)}
              className="upload-button"
              disabled={step === 2 && formData.resources.length === 0}
            >
              Next →
            </button>
          )}
          {step === 4 && (
            <button
              onClick={handleSubmit}
              className="upload-button"
              disabled={submitting || !formData.projectName || formData.resources.length === 0}
            >
              {submitting ? 'Creating...' : '✓ Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pmEmail, setPmEmail] = useState(localStorage.getItem('pmEmail') || '');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (pmEmail) {
      loadProjects();
      localStorage.setItem('pmEmail', pmEmail);
    }
  }, [pmEmail]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects/list', {
        headers: { 'x-pm-email': pmEmail },
      });
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!pmEmail) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', background: '#f4f6fb', minHeight: '100vh' }}>
        <h2>Welcome to Project Health Report</h2>
        <p>Enter your email to view projects assigned to you.</p>
        <input
          type="email"
          placeholder="your.email@company.com"
          value={pmEmail}
          onChange={(e) => setPmEmail(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && pmEmail && loadProjects()}
          style={{
            padding: '10px 12px',
            fontSize: '16px',
            width: '300px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            marginRight: '8px',
          }}
        />
        <button
          onClick={() => pmEmail && loadProjects()}
          className="upload-button"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0' }}>My Projects</h2>
          <span style={{ fontSize: '12px', color: '#8d99ae' }}>{pmEmail}</span>
        </div>
        <button
          className="upload-button"
          onClick={() => window.location.hash = '#/create'}
        >
          + New Project
        </button>
      </div>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="upload-section">
          <p>No projects yet. <a href="#/create" style={{ color: '#1e2761', fontWeight: '600' }}>Create your first project</a></p>
        </div>
      ) : (
        <div className="cards-grid">
          {projects.map(p => (
            <div
              key={p.id}
              className="project-card"
              onClick={() => window.location.hash = `#/projects/${p.id}`}
              style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'}
            >
              <div className="card-account">{p.name}</div>
              <div className="card-project">{p.client || 'No client'}</div>
              <div className="card-meta">
                <span><span className="meta-label">Type:</span> {p.billing_type}</span>
                {p.sow_value && <span><span className="meta-label">SOW:</span> ${p.sow_value.toLocaleString()}</span>}
              </div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
                Created {new Date(p.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectDashboard({ projectId }) {
  const [project, setProject] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const pmEmail = localStorage.getItem('pmEmail');

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/summary`, {
        headers: { 'x-pm-email': pmEmail },
      });
      const data = await res.json();
      if (data.success) {
        setProject({ id: projectId, ...data });
        setSummary(data.summary);
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async () => {
    if (!csvFile) return;

    const formData = new FormData();
    formData.append('csv', csvFile);

    try {
      setUploading(true);
      const res = await fetch(`/api/projects/${projectId}/csv-upload`, {
        method: 'POST',
        headers: { 'x-pm-email': pmEmail },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `✓ Imported ${data.rowsImported} rows. ${data.note}` });
        setSummary(data.summary);
        setCsvFile(null);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/download`, {
        headers: { 'x-pm-email': pmEmail },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.projectName || 'project'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ type: 'error', text: 'Download failed: ' + err.message });
    }
  };

  if (loading) return <div className="loading">Loading project...</div>;

  return (
    <div className="container">
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => window.location.hash = '#/'}
          style={{
            background: '#8d99ae',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '12px',
            fontSize: '14px',
          }}
        >
          ← Back
        </button>
        <h2 style={{ display: 'inline' }}>{project?.projectName}</h2>
        {project?.clientName && <span style={{ fontSize: '14px', color: '#8d99ae', marginLeft: '12px' }}>• {project.clientName}</span>}
      </div>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'} style={{ marginBottom: '16px' }}>
          {message.text}
        </div>
      )}

      <div className="upload-section">
        <h3 style={{ margin: '0 0 12px 0' }}>📤 Import Weekly Hours</h3>
        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 12px 0' }}>
          Upload the Power BI "Hours by Resource" export to update actual hours
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => setCsvFile(e.target.files?.[0])}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #cadcfc',
              flexGrow: 1,
              fontSize: '13px',
            }}
          />
          <button
            className="upload-button"
            onClick={handleCSVUpload}
            disabled={!csvFile || uploading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      {summary && (
        <>
          <div className="section-label">Hours Tracking</div>
          <div className="stats-grid">
            <div className="stat-box">
              <p className="stat-num">{Math.round(summary.actualHours || 0)}</p>
              <p className="stat-label">Actual Hours</p>
            </div>
            <div className="stat-box">
              <p className="stat-num">{Math.round(summary.eacHours || 0)}</p>
              <p className="stat-label">EAC Hours</p>
            </div>
            <div className="stat-box">
              <p className="stat-num" style={{ color: summary.varianceHours < 0 ? '#c0392b' : '#27ae60' }}>
                {Math.round(summary.varianceHours || 0)}
              </p>
              <p className="stat-label">Variance</p>
            </div>
            <div className="stat-box">
              <p className="stat-num">{((summary.percentDelivered || 0) * 100).toFixed(1)}%</p>
              <p className="stat-label">Delivered</p>
            </div>
          </div>

          <div className="section-label">Financial Summary</div>
          <div className="stats-grid">
            <div className="stat-box">
              <p className="stat-num">${(Math.round(summary.eacRevenue || 0) / 1000).toFixed(1)}k</p>
              <p className="stat-label">EAC Revenue</p>
            </div>
            <div className="stat-box">
              <p className="stat-num">${(Math.round(summary.eacCost || 0) / 1000).toFixed(1)}k</p>
              <p className="stat-label">EAC Cost</p>
            </div>
            <div className="stat-box">
              <p className="stat-num" style={{ color: (summary.eacMarginPct || 0) < (summary.targetMarginPct || 0) ? '#c0392b' : '#27ae60' }}>
                {((summary.eacMarginPct || 0) * 100).toFixed(1)}%
              </p>
              <p className="stat-label">Margin %</p>
            </div>
            <div className="stat-box">
              <p className="stat-num">{((summary.targetMarginPct || 0) * 100).toFixed(1)}%</p>
              <p className="stat-label">Target Margin</p>
            </div>
          </div>

          <div className="section-label">Schedule</div>
          <div className="stats-grid">
            <div className="stat-box">
              <p className="stat-num">{summary.weeksElapsed || 0}</p>
              <p className="stat-label">Weeks Elapsed</p>
            </div>
            <div className="stat-box">
              <p className="stat-num">{summary.weeksRemaining || 0}</p>
              <p className="stat-label">Weeks Remaining</p>
            </div>
            <div className="stat-box">
              <p className="stat-num">{((summary.schedulePercent || 0) * 100).toFixed(0)}%</p>
              <p className="stat-label">Schedule %</p>
            </div>
            <div className="stat-box">
              <p className="stat-num">{Math.round(summary.burnRate || 0)}</p>
              <p className="stat-label">Burn Rate (hrs/wk)</p>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #cadcfc' }}>
        <button
          className="upload-button"
          onClick={handleDownload}
          style={{ background: '#27ae60' }}
        >
          ⬇️ Download Excel File
        </button>
        <p style={{ fontSize: '12px', color: '#8d99ae', marginTop: '8px' }}>
          Download to recalculate formulas in Excel and make manual updates
        </p>
      </div>
    </div>
  );
}

function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const path = hash.slice(1).split('/');
  const [page, id] = path;

  return (
    <div>
      <header>
        <h1>📊 Project Health Report</h1>
        <div className="subtitle">Manage project forecasts and actuals</div>
      </header>
      {page === 'create' ? (
        <CreateProjectWizard />
      ) : page === 'projects' && id ? (
        <ProjectDashboard projectId={parseInt(id)} />
      ) : (
        <ProjectList />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
