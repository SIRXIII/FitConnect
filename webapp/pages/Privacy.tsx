const Privacy: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl serif font-light italic text-ink">Privacy Policy</h1>
          <p className="text-xs text-ink/40 uppercase tracking-[0.2em]">Last updated: March 19, 2026</p>
        </div>

        <div className="space-y-8 text-sm text-ink/70 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">1. Information We Collect</h2>
            <p>
              We collect information you provide directly, including your name, email address,
              profile details, and payment information. We also collect usage data such as
              booking history and platform interactions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">2. How We Use Information</h2>
            <p>
              Your information is used to provide and improve our services, process payments,
              facilitate communication between clients and trainers, and send relevant
              notifications about your bookings and account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">3. Data Sharing</h2>
            <p>
              We share limited information with trainers to facilitate bookings, with Stripe
              to process payments, and with service providers who help us operate the platform.
              We do not sell your personal data to third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">4. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including
              encryption in transit and at rest. Payment information is handled exclusively
              by Stripe and is never stored on our servers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">5. Your Rights</h2>
            <p>
              You have the right to access, correct, or delete your personal data. You can
              export your data at any time through your account settings. To request data
              deletion, please contact us directly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">6. Cookies</h2>
            <p>
              We use essential cookies to maintain your session and preferences. We do not
              use third-party tracking cookies for advertising purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg serif font-light text-ink">7. Contact Us</h2>
            <p>
              If you have questions about this privacy policy or your data, please reach out
              through the platform or email us at support@fitrush.app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
