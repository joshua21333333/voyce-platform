import { LegalShell, P, H2 } from '../shell'

export const metadata = { title: 'Privacy Policy — Voyce' }

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="2026-06-18">
      <P>
        This policy explains what Voyce collects, how it is used, and the choices you have. It is a
        working draft intended to be reviewed by counsel before commercial launch.
      </P>

      <H2>What we collect</H2>
      <P>
        Account details (name, email, company), the onboarding answers and writing samples you provide,
        the content Voyce produces for you, your approvals and revisions, and operational metadata
        (usage counts, billing status). Publishing-integration tokens (e.g. Buffer) are stored encrypted
        at rest using AES-256-GCM.
      </P>

      <H2>AI processing disclosure</H2>
      <P>
        Voyce uses large language models (the Claude API by Anthropic) to synthesize your Brand
        Intelligence Layer and to generate content. Your onboarding answers, writing samples, and brand
        context are sent to that model provider to produce your drafts. We do not sell your data, and one
        client&apos;s data is never used as another client&apos;s context.
      </P>

      <H2>How we use it</H2>
      <P>
        To build your voice profile, produce and evaluate drafts, deliver them for approval, publish
        approved content to channels you connect, bill your subscription, and improve reliability. We do
        not use your private content to train third-party base models.
      </P>

      <H2>Retention &amp; your rights</H2>
      <P>
        We retain your data for the life of your account and delete it on request. Subject to applicable
        law (including GDPR where relevant), you may request access, correction, export, or deletion of
        your personal data by contacting support.
      </P>

      <H2>Third parties</H2>
      <P>
        We share data only with the processors required to run the service: the AI provider (Anthropic),
        email delivery (Resend), payments (Stripe), object storage (Cloudflare R2), background execution
        (Trigger.dev), and any publishing channel you explicitly connect.
      </P>
    </LegalShell>
  )
}
