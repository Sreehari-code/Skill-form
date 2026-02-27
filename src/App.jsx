import React, { useMemo, useState } from 'react';

const STORAGE_KEY = 'skill_form_submissions_v1';
const ADMIN_AUTH_KEY = 'skill_form_admin_auth_v1';
const ADMIN_PASSWORD = 'sreeharis0022';

const SKILLS = [
  'Additive Manufacturing (3D Printing)',
  'Agentic AI & LLM Optimization',
  'Autonomous Mobile Robotics (AMR)',
  'Battery Management Systems (BMS)',
  'Big Data Analytics and machine learning',
  'Bio-Process Engineering',
  'Bioinformatics and Data Analytics',
  'Blockchain Technology',
  'Cloud Computing',
  'Computational Fluid Dynamics (CFD)',
  'Computer Vision and Image Processing',
  'Control System',
  'Cyber Security and Cryptography',
  'Data Acquisition System',
  'Design for Manufacturing and Assembly',
  'DevOps and IT Infra',
  'Digital Signal Processing',
  'Edge AI',
  'Embedded Systems & Firmware',
  'FPGA Prototyping',
  'Full-Stack Software Development',
  'IoT and Sensor Integration',
  'Manufacturing and Fabrication',
  'Mechanical Engineering CAD and FEA',
  'Mechanical Modelling',
  'Mechanisms Design',
  'Microbial and Plant Bioprospecting',
  'Molecular Biology and Genetic Engineering',
  'Natural Language Processing',
  'PCB Design and Development',
  'PLC and Industrial Control',
  'Pneumatics & Electro-Pneumatics',
  'Power Electronics & Grid Integration',
  'Power System',
  'Precision Agriculture (Agri-Tech)',
  'Robot Systems Integration',
  'Servo-Drives & Motion Control',
  'Unmanned Aerial Systems',
  'VLSI & Circuit Design'
];

const PRIMARY1_POSITION_WEIGHTS = [10, 8, 6, 4, 2];
const PRIMARY2_POSITION_WEIGHTS = [6, 5, 4, 3, 2];
const SECONDARY_POSITION_WEIGHTS = [2, 1];

const TIME_WINDOWS = [
  { key: 'all', label: 'All Time', days: null },
  { key: '30', label: 'Last 30 Days', days: 30 },
  { key: '7', label: 'Last 7 Days', days: 7 }
];

const emptyForm = {
  name: '',
  rollNumber: '',
  email: '',
  department: '',
  year: '',
  phone: '',
  primary1: [],
  primary2: [],
  secondary: []
};

function getSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSubmissions(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function normalizeSecondary(item) {
  return Array.isArray(item.secondary)
    ? item.secondary
    : [item.secondary1, item.secondary2].filter(Boolean);
}

function scoreByPosition(weights, index) {
  return weights[index] ?? 1;
}

function buildInterestRanking(items) {
  const map = new Map(
    SKILLS.map((skill) => [
      skill,
      { skill, score: 0, primary1Count: 0, primary2Count: 0, secondaryCount: 0, totalSelections: 0 }
    ])
  );

  for (const item of items) {
    const p1 = Array.isArray(item.primary1) ? item.primary1 : [];
    const p2 = Array.isArray(item.primary2) ? item.primary2 : [];
    const secondary = normalizeSecondary(item);

    p1.forEach((skill, index) => {
      const row = map.get(skill);
      if (!row) return;
      row.primary1Count += 1;
      row.totalSelections += 1;
      row.score += scoreByPosition(PRIMARY1_POSITION_WEIGHTS, index);
    });

    p2.forEach((skill, index) => {
      const row = map.get(skill);
      if (!row) return;
      row.primary2Count += 1;
      row.totalSelections += 1;
      row.score += scoreByPosition(PRIMARY2_POSITION_WEIGHTS, index);
    });

    secondary.forEach((skill, index) => {
      const row = map.get(skill);
      if (!row) return;
      row.secondaryCount += 1;
      row.totalSelections += 1;
      row.score += scoreByPosition(SECONDARY_POSITION_WEIGHTS, index);
    });
  }

  return [...map.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.primary1Count !== a.primary1Count) return b.primary1Count - a.primary1Count;
    if (b.totalSelections !== a.totalSelections) return b.totalSelections - a.totalSelections;
    return a.skill.localeCompare(b.skill);
  });
}

function withinDays(isoDate, days) {
  if (!days) return true;
  const created = new Date(isoDate);
  if (Number.isNaN(created.getTime())) return false;
  const now = Date.now();
  const threshold = now - days * 24 * 60 * 60 * 1000;
  return created.getTime() >= threshold;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename, headers, rows) {
  const csvText = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');

  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function uniqueOrdered(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = String(item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function buildTwoPlusTwoAssignment(item) {
  const p1 = Array.isArray(item.primary1) ? item.primary1 : [];
  const p2 = Array.isArray(item.primary2) ? item.primary2 : [];
  const secondary = normalizeSecondary(item);
  const ordered = uniqueOrdered([...p1, ...p2, ...secondary]);

  const primaryAssigned = ordered.slice(0, 2);
  const primaryKey = new Set(primaryAssigned.map((skill) => skill.toLowerCase()));
  const secondaryAssigned = ordered
    .filter((skill) => !primaryKey.has(skill.toLowerCase()))
    .slice(0, 2);

  return { primaryAssigned, secondaryAssigned };
}

function StudentForm() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submissionsSnapshot, setSubmissionsSnapshot] = useState(() => getSubmissions());

  const totalSelected = form.primary1.length + form.primary2.length + form.secondary.length;
  const completionPercent = Math.round((totalSelected / 12) * 100);

  const trendingCourses = useMemo(
    () => buildInterestRanking(submissionsSnapshot).filter((row) => row.totalSelections > 0).slice(0, 5),
    [submissionsSnapshot]
  );

  function updateField(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function updateSkillList(name, nextList) {
    setForm((prev) => ({ ...prev, [name]: nextList }));
  }

  function validate(data) {
    const requiredBasic = [
      data.name,
      data.rollNumber,
      data.email,
      data.department,
      data.year,
      data.phone
    ];

    if (requiredBasic.some((item) => !item.trim())) {
      return 'Please fill all basic details.';
    }

    if (data.primary1.length !== 5 || data.primary2.length !== 5) {
      return 'Please select exactly 5 skills in Primary Skill 1 and 5 in Primary Skill 2.';
    }

    if (data.secondary.length !== 2) {
      return 'Please select exactly 2 secondary skills.';
    }

    const allSkills = [...data.primary1, ...data.primary2, ...data.secondary];
    const unique = new Set(allSkills.map((item) => item.toLowerCase()));
    if (unique.size !== allSkills.length) {
      return 'Each selected skill must be unique across primary and secondary.';
    }

    return '';
  }

  function onSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const submissions = getSubmissions();
    const entry = {
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
      ...form
    };

    const nextSubmissions = [entry, ...submissions];
    saveSubmissions(nextSubmissions);
    setSubmissionsSnapshot(nextSubmissions);
    setSuccess('Submission saved. Admin can view all submissions at /admin.');
    setForm(emptyForm);
  }

  return (
    <main className="page">
      <section className="card">
        <div className="heroStrip">
          <div>
            <h1>Course Interest Form</h1>
            <p className="subtext">
              Pick 5 for Primary 1, 5 for Primary 2, and 2 for Secondary. Rank each list by
              interest with the up/down controls.
            </p>
          </div>
          <a className="linkBtn" href="/admin">
            Admin View
          </a>
        </div>

        <div className="progressCard">
          <div className="progressTop">
            <strong>Completion</strong>
            <span>{totalSelected}/12 selected</span>
          </div>
          <div className="progressTrack">
            <div className="progressFill" style={{ width: `${completionPercent}%` }} />
          </div>
        </div>

        <div className="formLayout">
          <form onSubmit={onSubmit}>
            <div className="grid">
              <Field label="Name" name="name" value={form.name} onChange={updateField} />
              <Field label="Roll Number" name="rollNumber" value={form.rollNumber} onChange={updateField} />
              <Field label="Email" name="email" type="email" value={form.email} onChange={updateField} />
              <Field label="Department" name="department" value={form.department} onChange={updateField} />
              <SelectField label="Year" name="year" value={form.year} onChange={updateField} className="compact">
                <option value="">Select year</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </SelectField>
              <Field label="Phone" name="phone" value={form.phone} onChange={updateField} className="compact" />
            </div>

            <div className="pickerGrid">
              <SkillChecklistField
                label="Primary Skill 1"
                selected={form.primary1}
                max={5}
                exclude={[...form.primary2, ...form.secondary]}
                onChange={(next) => updateSkillList('primary1', next)}
              />
              <SkillChecklistField
                label="Primary Skill 2"
                selected={form.primary2}
                max={5}
                exclude={[...form.primary1, ...form.secondary]}
                onChange={(next) => updateSkillList('primary2', next)}
              />
              <SkillChecklistField
                label="Secondary Skills"
                selected={form.secondary}
                max={2}
                exclude={[...form.primary1, ...form.primary2]}
                onChange={(next) => updateSkillList('secondary', next)}
              />
            </div>

            {error ? <p className="error">{error}</p> : null}
            {success ? <p className="success">{success}</p> : null}

            <div className="actions">
              <button type="submit" className="primaryBtn">Submit</button>
              <button
                type="button"
                className="ghostBtn"
                onClick={() => {
                  setForm(emptyForm);
                  setError('');
                  setSuccess('');
                }}
              >
                Reset
              </button>
            </div>
          </form>

          <aside className="insightPanel">
            <h3>Your Selection Summary</h3>
            <ul className="plainList">
              <li>Primary Skill 1: {form.primary1.length}/5</li>
              <li>Primary Skill 2: {form.primary2.length}/5</li>
              <li>Secondary: {form.secondary.length}/2</li>
            </ul>

            <h3>Popular Courses</h3>
            {trendingCourses.length === 0 ? (
              <p className="subtext">No submissions yet. Be the first to submit.</p>
            ) : (
              <ol className="plainList">
                {trendingCourses.map((row) => (
                  <li key={row.skill}>
                    {row.skill} ({row.score})
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function AdminView() {
  const [items, setItems] = useState(() => getSubmissions());
  const [windowKey, setWindowKey] = useState('all');

  const activeWindow = useMemo(
    () => TIME_WINDOWS.find((windowOption) => windowOption.key === windowKey) ?? TIME_WINDOWS[0],
    [windowKey]
  );

  const filteredItems = useMemo(
    () => items.filter((item) => withinDays(item.submittedAt, activeWindow.days)),
    [items, activeWindow.days]
  );

  const sortedFilteredSubmissions = useMemo(
    () => [...filteredItems].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)),
    [filteredItems]
  );

  const interestRanking = useMemo(() => buildInterestRanking(filteredItems), [filteredItems]);

  const topTen = useMemo(
    () => interestRanking.filter((row) => row.totalSelections > 0).slice(0, 10),
    [interestRanking]
  );

  const departmentRankings = useMemo(() => {
    const grouped = {};
    for (const item of filteredItems) {
      const department = item.department?.trim() ? item.department.trim() : 'Unknown';
      if (!grouped[department]) grouped[department] = [];
      grouped[department].push(item);
    }

    return Object.entries(grouped)
      .map(([department, deptItems]) => ({
        department,
        topRows: buildInterestRanking(deptItems).filter((row) => row.totalSelections > 0).slice(0, 5)
      }))
      .sort((a, b) => a.department.localeCompare(b.department));
  }, [filteredItems]);

  const demandAlerts = useMemo(() => {
    const highThreshold = Math.max(3, Math.ceil(filteredItems.length * 0.6));
    const lowThreshold = Math.max(1, Math.floor(filteredItems.length * 0.15));

    const rowsWithPicks = interestRanking.filter((row) => row.totalSelections > 0);
    return {
      highDemand: rowsWithPicks.filter((row) => row.totalSelections >= highThreshold).slice(0, 6),
      lowDemand: rowsWithPicks.filter((row) => row.totalSelections <= lowThreshold).slice(0, 6)
    };
  }, [filteredItems.length, interestRanking]);

  const assignments = useMemo(
    () => sortedFilteredSubmissions.map((item) => ({ item, ...buildTwoPlusTwoAssignment(item) })),
    [sortedFilteredSubmissions]
  );

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    setItems([]);
  }

  function deleteOne(id) {
    const next = items.filter((item) => item.id !== id);
    saveSubmissions(next);
    setItems(next);
  }

  function exportRankingCsv() {
    const rows = interestRanking.map((row, index) => [
      index + 1,
      row.skill,
      row.score,
      row.totalSelections,
      row.primary1Count,
      row.primary2Count,
      row.secondaryCount
    ]);
    downloadCsv(
      `course-ranking-${windowKey}.csv`,
      ['Rank', 'Course', 'Score', 'Total Picks', 'Primary 1', 'Primary 2', 'Secondary'],
      rows
    );
  }

  function exportSubmissionsCsv() {
    const rows = sortedFilteredSubmissions.map((item) => [
      item.name,
      item.rollNumber,
      item.email,
      item.department,
      item.year,
      item.phone,
      Array.isArray(item.primary1) ? item.primary1.join(' | ') : item.primary1,
      Array.isArray(item.primary2) ? item.primary2.join(' | ') : item.primary2,
      normalizeSecondary(item).join(' | '),
      new Date(item.submittedAt).toLocaleString()
    ]);

    downloadCsv(
      `submissions-${windowKey}.csv`,
      ['Name', 'Roll No', 'Email', 'Department', 'Year', 'Phone', 'Primary 1', 'Primary 2', 'Secondary', 'Submitted'],
      rows
    );
  }

  function exportAssignmentsCsv() {
    const rows = assignments.map(({ item, primaryAssigned, secondaryAssigned }) => [
      item.name,
      item.rollNumber,
      item.department,
      primaryAssigned.join(' | '),
      secondaryAssigned.join(' | '),
      new Date(item.submittedAt).toLocaleString()
    ]);

    downloadCsv(
      `allocations-2p2s-${windowKey}.csv`,
      ['Name', 'Roll No', 'Department', 'Assigned Primary (2)', 'Assigned Secondary (2)', 'Submitted'],
      rows
    );
  }

  return (
    <main className="page">
      <section className="card">
        <div className="headerRow">
          <h1>Admin - Interest Analytics</h1>
          <a className="linkBtn" href="/">Back To Form</a>
        </div>

        <div className="filtersBar">
          <label className="field compact">
            <span>Trend Window</span>
            <select value={windowKey} onChange={(event) => setWindowKey(event.target.value)}>
              {TIME_WINDOWS.map((windowOption) => (
                <option key={windowOption.key} value={windowOption.key}>
                  {windowOption.label}
                </option>
              ))}
            </select>
          </label>

          <div className="actions">
            <button type="button" className="primaryBtn" onClick={exportRankingCsv}>Export Ranking CSV</button>
            <button type="button" className="ghostBtn" onClick={exportSubmissionsCsv}>Export Submissions CSV</button>
            <button type="button" className="ghostBtn" onClick={exportAssignmentsCsv}>Export 2P2S Allocation CSV</button>
            <button type="button" className="dangerBtn" onClick={clearAll}>Clear All</button>
          </div>
        </div>

        <h2 className="sectionTitle">Top 10 Summary</h2>
        {topTen.length === 0 ? (
          <p className="subtext">No ranked courses yet for this time window.</p>
        ) : (
          <ol className="topList">
            {topTen.map((row) => (
              <li key={row.skill}>
                <span>{row.skill}</span>
                <strong>{row.score}</strong>
              </li>
            ))}
          </ol>
        )}

        <h2 className="sectionTitle">Demand Alerts</h2>
        <div className="alertGrid">
          <section className="alertCard">
            <h3>High Demand Courses</h3>
            {demandAlerts.highDemand.length === 0 ? (
              <p className="subtext">No high-demand signals yet.</p>
            ) : (
              <ul className="plainList">
                {demandAlerts.highDemand.map((row) => (
                  <li key={row.skill}>{row.skill} ({row.totalSelections} picks)</li>
                ))}
              </ul>
            )}
          </section>

          <section className="alertCard">
            <h3>Low Demand Courses</h3>
            {demandAlerts.lowDemand.length === 0 ? (
              <p className="subtext">No low-demand signals yet.</p>
            ) : (
              <ul className="plainList">
                {demandAlerts.lowDemand.map((row) => (
                  <li key={row.skill}>{row.skill} ({row.totalSelections} picks)</li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <h2 className="sectionTitle">Course Interest Ranking</h2>
        <p className="subtext">
          Position-weighted score is used. Tie-break order: higher score, then higher Primary 1 picks,
          then higher total picks, then alphabetical course name.
        </p>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Course</th>
                <th>Score</th>
                <th>Total Picks</th>
                <th>Primary 1</th>
                <th>Primary 2</th>
                <th>Secondary</th>
              </tr>
            </thead>
            <tbody>
              {interestRanking.map((row, index) => (
                <tr key={row.skill}>
                  <td>{index + 1}</td>
                  <td>{row.skill}</td>
                  <td>{row.score}</td>
                  <td>{row.totalSelections}</td>
                  <td>{row.primary1Count}</td>
                  <td>{row.primary2Count}</td>
                  <td>{row.secondaryCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="sectionTitle">Department-wise Top Courses</h2>
        {departmentRankings.length === 0 ? (
          <p className="subtext">No department-level data found for this window.</p>
        ) : (
          <div className="deptGrid">
            {departmentRankings.map((departmentData) => (
              <section key={departmentData.department} className="deptCard">
                <h3>{departmentData.department}</h3>
                {departmentData.topRows.length === 0 ? (
                  <p className="subtext">No picks yet.</p>
                ) : (
                  <ol className="plainList">
                    {departmentData.topRows.map((row) => (
                      <li key={`${departmentData.department}-${row.skill}`}>
                        {row.skill} ({row.score})
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        )}

        <h2 className="sectionTitle">All Submissions</h2>
        {sortedFilteredSubmissions.length === 0 ? (
          <p className="subtext">No submissions found for this window.</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll No</th>
                  <th>Department</th>
                  <th>Primary 1</th>
                  <th>Primary 2</th>
                  <th>Secondary</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedFilteredSubmissions.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.rollNumber}</td>
                    <td>{item.department}</td>
                    <td>{Array.isArray(item.primary1) ? item.primary1.join(', ') : item.primary1}</td>
                    <td>{Array.isArray(item.primary2) ? item.primary2.join(', ') : item.primary2}</td>
                    <td>{normalizeSecondary(item).join(', ')}</td>
                    <td>{new Date(item.submittedAt).toLocaleString()}</td>
                    <td>
                      <button className="smallDanger" type="button" onClick={() => deleteOne(item.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="sectionTitle">2 Primary + 2 Secondary Allocation Helper</h2>
        <p className="subtext">
          Auto-rule used for each student: take first 2 highest-ranked preferences as Primary,
          then next 2 as Secondary (unique skills only).
        </p>
        {assignments.length === 0 ? (
          <p className="subtext">No submissions available to allocate.</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll No</th>
                  <th>Department</th>
                  <th>Assigned Primary (2)</th>
                  <th>Assigned Secondary (2)</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(({ item, primaryAssigned, secondaryAssigned }) => (
                  <tr key={`alloc-${item.id}`}>
                    <td>{item.name}</td>
                    <td>{item.rollNumber}</td>
                    <td>{item.department}</td>
                    <td>{primaryAssigned.join(', ')}</td>
                    <td>{secondaryAssigned.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function AdminAuthGate() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthed, setIsAuthed] = useState(() => localStorage.getItem(ADMIN_AUTH_KEY) === 'ok');

  function onSubmit(event) {
    event.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_AUTH_KEY, 'ok');
      setIsAuthed(true);
      setPassword('');
      setError('');
      return;
    }
    setError('Invalid password.');
  }

  function logout() {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    setIsAuthed(false);
    setPassword('');
    setError('');
  }

  if (!isAuthed) {
    return (
      <main className="page">
        <section className="card">
          <div className="headerRow">
            <h1>Admin Access</h1>
            <a className="linkBtn" href="/">Back To Form</a>
          </div>

          <p className="subtext">Enter password to open admin dashboard.</p>

          <form onSubmit={onSubmit} className="authForm">
            <label className="field compact">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="actions">
              <button type="submit" className="primaryBtn">Unlock Admin</button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="adminTopBar">
        <button type="button" className="ghostBtn" onClick={logout}>Admin Logout</button>
      </div>
      <AdminView />
    </>
  );
}

function Field({ label, name, value, onChange, type = 'text', className = '' }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      <input name={name} value={value} type={type} onChange={onChange} />
    </label>
  );
}

function SelectField({ label, name, value, onChange, children, className = '' }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      <select name={name} value={value} onChange={onChange}>
        {children}
      </select>
    </label>
  );
}

function SkillChecklistField({ label, selected, max, exclude, onChange }) {
  const [query, setQuery] = useState('');

  const blocked = useMemo(() => new Set(exclude.map((skill) => skill.toLowerCase())), [exclude]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SKILLS.filter((skill) => skill.toLowerCase().includes(q));
  }, [query]);

  function toggleSkill(skill) {
    const has = selected.includes(skill);
    if (has) {
      onChange(selected.filter((item) => item !== skill));
      return;
    }

    if (selected.length >= max || blocked.has(skill.toLowerCase())) {
      return;
    }

    onChange([...selected, skill]);
  }

  function moveSkill(index, offset) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= selected.length) return;

    const next = [...selected];
    const moving = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = moving;
    onChange(next);
  }

  function clearAllSelected() {
    onChange([]);
  }

  return (
    <section className="skillPanel">
      <div className="skillPanelHead">
        <h3>{label}</h3>
        <div className="skillPanelMeta">
          <span className="countPill">{selected.length}/{max}</span>
          {selected.length > 0 ? (
            <button type="button" className="tinyBtn" onClick={clearAllSelected}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <input
        className="searchInput"
        type="text"
        placeholder="Search and add courses"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="rankList">
        {selected.map((skill, index) => (
          <div key={skill} className="rankItem">
            <span className="rankBadge">#{index + 1}</span>
            <span className="rankName">{skill}</span>
            <div className="rankActions">
              <button type="button" className="tinyBtn" onClick={() => moveSkill(index, -1)} disabled={index === 0}>
                Up
              </button>
              <button
                type="button"
                className="tinyBtn"
                onClick={() => moveSkill(index, 1)}
                disabled={index === selected.length - 1}
              >
                Down
              </button>
              <button type="button" className="tinyDanger" onClick={() => toggleSkill(skill)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="optionGrid" role="listbox" aria-label={label}>
        {options.map((skill) => {
          const checked = selected.includes(skill);
          const isBlocked = blocked.has(skill.toLowerCase()) && !checked;
          return (
            <button
              key={skill}
              type="button"
              className={`optionCard ${checked ? 'selected' : ''} ${isBlocked ? 'disabled' : ''}`.trim()}
              disabled={isBlocked}
              onClick={() => toggleSkill(skill)}
            >
              <span className="optionName">{skill}</span>
              <span className="optionState">
                {checked ? `Rank ${selected.indexOf(skill) + 1}` : 'Add'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const isAdmin = window.location.pathname.toLowerCase() === '/admin';
  return isAdmin ? <AdminAuthGate /> : <StudentForm />;
}
