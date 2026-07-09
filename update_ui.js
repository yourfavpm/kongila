const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/admin-panel/pages/index.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update talent-pipeline rendering
const talentPipelineOld = `          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['All', 'Applied', 'Pending', 'Review', 'Vetted'].map(f => (
              <button key={f} onClick={() => { setTalentFilter(f); setSelectedTalent(null); }} style={{ padding: '6px 16px', borderRadius: '999px', border: \`1px solid \${talentFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}\`, background: talentFilter === f ? 'var(--kongila-blue-glow)' : 'var(--bg-secondary)', color: talentFilter === f ? 'var(--kongila-blue)' : 'var(--text-secondary)', fontWeight: talentFilter === f ? 600 : 400, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>{f}</button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>{filteredTalents.length} talent{filteredTalents.length !== 1 ? 's' : ''}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedTalent ? '1fr 1.4fr' : '1fr', gap: '24px' }}>
            <div className="table-container">`;

const talentPipelineNew = `          {selectedTalent ? (
            <div>
              <button onClick={() => setSelectedTalent(null)} className="btn-secondary" style={{ marginBottom: '20px', fontSize: '13px', padding: '6px 14px', borderRadius: '8px' }}>← Back to Pipeline</button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <GlassCard>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                    {selectedTalent.avatar ? <img src={selectedTalent.avatar} alt="" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>👤</div>}
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700 }}>{selectedTalent.name}</h3>
                      <div style={{ fontSize: '13px', color: 'var(--accent-cyan)' }}>{selectedTalent.title}</div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <Chip label={selectedTalent.vettingStatus} />
                        <span style={{ fontWeight: 800, color: getGradeColor(selectedTalent.grade) }}>Grade: {selectedTalent.grade}</span>
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>{selectedTalent.bio || 'No bio provided.'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                    {[
                      { label: 'Timezone', val: selectedTalent.timezone },
                      { label: 'Experience', val: \`\${selectedTalent.experienceYears} years\` },
                      { label: 'Expected Rate', val: selectedTalent.salaryExpectation ? formatCurrency(selectedTalent.salaryExpectation) + '/mo' : '—' },
                      { label: 'Availability', val: \`\${selectedTalent.availability}%\` },
                      { label: 'Vetting Stage', val: selectedTalent.vettingStage },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontWeight: 600 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {selectedTalent.tags && selectedTalent.tags.length > 0 && (
                    <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {selectedTalent.tags.map(tag => <span key={tag} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', fontWeight: 500 }}>{tag}</span>)}
                    </div>
                  )}
                </GlassCard>

                <GlassCard>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>7-Stage Vetting Scores</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.entries(selectedTalent.vettingScores).map(([key, val]) => (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span style={{ fontWeight: 700 }}>{val as React.ReactNode}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: \`\${val}%\`, height: '100%', background: (val as number) >= 85 ? 'var(--accent-green)' : (val as number) >= 70 ? 'var(--accent-gold)' : 'var(--accent-magenta)', borderRadius: '999px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Composite Grade</span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: getGradeColor(selectedTalent.grade) }}>{selectedTalent.grade} — {calculateCompositeVettingGrade(selectedTalent.vettingScores).score}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => setActiveTab('vetting')} className="btn-primary" style={{ height: '34px', padding: '0 14px', fontSize: '12px', borderRadius: '8px' }}>Edit Scorecard</button>
                    <button onClick={() => setActiveTab('matching')} className="btn-secondary" style={{ height: '34px', padding: '0 14px', fontSize: '12px', borderRadius: '8px' }}>Shortlist</button>
                  </div>
                </GlassCard>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Search by name, title, or tags..." 
                  value={talentSearchQuery} 
                  onChange={(e) => setTalentSearchQuery(e.target.value)}
                  style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none', minWidth: '250px', fontSize: '13px' }} 
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['All', 'Applied', 'Pending', 'Review', 'Vetted'].map(f => (
                    <button key={f} onClick={() => setTalentFilter(f)} style={{ padding: '6px 16px', borderRadius: '999px', border: \`1px solid \${talentFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}\`, background: talentFilter === f ? 'var(--kongila-blue-glow)' : 'var(--bg-secondary)', color: talentFilter === f ? 'var(--kongila-blue)' : 'var(--text-secondary)', fontWeight: talentFilter === f ? 600 : 400, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>{f}</button>
                  ))}
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>{filteredTalents.length} talent{filteredTalents.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="table-container">`;

content = content.replace(talentPipelineOld, talentPipelineNew);

const oldTalentClick = `onClick={() => setSelectedTalent(selectedTalent?.id === t.id ? null : t)} style={{ cursor: 'pointer', background: selectedTalent?.id === t.id ? 'var(--kongila-blue-glow)' : undefined }}`;
const newTalentClick = `onClick={() => setSelectedTalent(t)} style={{ cursor: 'pointer' }}`;
content = content.replace(oldTalentClick, newTalentClick);

// 2. Remove the old selectedTalent display below the table
// Since the string is multiline and complex, we use regex to remove everything from `{selectedTalent && (` to the closing `)}` inside `case 'talent-pipeline':`.
const regexSelectedTalent = /\{selectedTalent && \([\s\S]*?\}\s*\)\}\s*<\/div>\s*<\/div>\s*\)\;/;
// We actually need to only remove it from case 'talent-pipeline'
const tpBlockStart = content.indexOf(`case 'talent-pipeline':`);
const tpBlockEnd = content.indexOf(`case 'client-pipeline':`, tpBlockStart);
let tpBlock = content.slice(tpBlockStart, tpBlockEnd);

const selectedTalentUIOld = tpBlock.substring(
    tpBlock.indexOf('{selectedTalent && ('),
    tpBlock.indexOf('          </div>\n        </div>\n      );')
);

if (selectedTalentUIOld) {
  tpBlock = tpBlock.replace(selectedTalentUIOld, '  </>\n          )}\n');
  content = content.substring(0, tpBlockStart) + tpBlock + content.substring(tpBlockEnd);
}

fs.writeFileSync(filePath, content);
console.log('Successfully updated talent pipeline UI');
