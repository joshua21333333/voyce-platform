import { VoyceLogoPng } from '@/components/VoyceLogo'

export default function CheckEmailPage() {
  return (
    <div
      className="bg-grid"
      style={{ minHeight: '100vh', backgroundColor: '#0a0b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <VoyceLogoPng size={40} />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px', color: '#f0f2f8' }}>
          Check your email
        </h1>
        <p style={{ color: '#9ba3b8', fontSize: '14px', lineHeight: 1.7 }}>
          We sent you a sign-in link. Click it to access your dashboard.
        </p>
        <p style={{ color: '#5a6278', fontSize: '12px', marginTop: '16px' }}>
          Link expires in 24 hours.
        </p>
      </div>
    </div>
  )
}
