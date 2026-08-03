const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl serif font-light italic text-ink">Terms of Service</h1>
          <p className="text-xs text-ink/40 uppercase tracking-[0.2em]">Last updated: March 19, 2026</p>
        </div>

        <div className="space-y-8 text-sm text-ink/70 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">1. Acceptance of Terms</h2>
            <p>
              By accessing or using FitRush, you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use our platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">2. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. You must provide accurate and
              complete information when creating an account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">3. Booking & Cancellation</h2>
            <p>
              Sessions booked through FitRush are subject to our cancellation policy. Cancellations
              made more than 24 hours before a scheduled session are eligible for a full refund.
              Cancellations within 24 hours may be subject to a cancellation fee.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">4. Payments</h2>
            <p>
              All payments are processed securely through Stripe. By making a payment, you agree
              to Stripe's terms of service. Trainers receive payouts on a weekly basis for
              completed sessions, minus applicable platform fees.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">5. Trainer Responsibilities</h2>
            <p>
              Trainers on FitRush are independent professionals. They are responsible for
              maintaining appropriate certifications, insurance, and professional standards.
              FitRush does not employ trainers directly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">6. Limitation of Liability</h2>
            <p>
              FitRush provides a platform connecting clients with trainers. We are not liable for
              injuries, damages, or losses arising from training sessions. Users participate in
              all fitness activities at their own risk.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">7. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of FitRush
              after changes constitutes acceptance of the updated terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
