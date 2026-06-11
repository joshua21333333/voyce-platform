export default function SettingsPage() {
  return (
    <div>
      <h1 style={{ fontSize: '30px', fontWeight: 600, marginBottom: '4px' }}>Settings</h1>
      <p style={{ color: '#9ba3b8', fontSize: '13px', marginBottom: '40px' }}>
        Workflow configuration, platform connections, delivery preferences.
      </p>

      {/* Autonomy levels teaser */}
      <div
        style={{
          background: '#111318',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px',
          padding: '28px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Autonomy Level</h2>
            <p style={{ color: '#9ba3b8', fontSize: '13px' }}>Control how much Voyce publishes without your review.</p>
          </div>
          <span style={{ fontSize: '11px', color: '#4b9eff', background: 'rgba(75,158,255,0.1)', padding: '3px 10px', borderRadius: '4px' }}>Sprint 3</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Manual review', 'Confidence gate', 'Fully autonomous'].map((level, i) => (
            <div key={level} style={{ flex: 1, padding: '12px', background: i === 0 ? 'rgba(75,158,255,0.08)' : '#0d0e12', border: `1px solid ${i === 0 ? 'rgba(75,158,255,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px' }}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: i === 0 ? '#4b9eff' : '#9ba3b8', marginBottom: '4px' }}>Level {i + 1}</p>
              <p style={{ fontSize: '11px', color: '#5a6278' }}>{level}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '80px 40px', textAlign: 'center' }}>
        <p style={{ color: '#5a6278', fontSize: '13px' }}>Full settings panel — Sprint 3</p>
      </div>
    </div>
  )
}
