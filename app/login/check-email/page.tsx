export default function CheckEmailPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF7F2',
        padding: '24px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '28px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            marginBottom: '24px',
          }}
        >
          Voyce
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '12px',
          }}
        >
          Check your email
        </h1>
        <p style={{ color: '#666', fontSize: '14px', lineHeight: 1.7 }}>
          We've sent you a sign-in link. Click it to access your dashboard.
          <br />
          <br />
          The link expires in 24 hours.
        </p>
      </div>
    </div>
  )
}
