import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';

interface StepPaymentProps {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onBack: () => void;
  PaymentFormComponent: React.FC<{
    onSuccess: () => void;
    onBack: () => void;
    amount: number;
  }>;
}

export const StepPayment: React.FC<StepPaymentProps> = ({
  clientSecret,
  amount,
  onSuccess,
  onBack,
  PaymentFormComponent,
}) => {
  if (!stripePromise) return null;

  return (
    <div className="space-y-8">
      {/* Compact session summary */}
      <div className="border border-ink/10 p-6 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
            Payment Amount
          </p>
        </div>
        <p className="text-xl serif font-light text-accent">${amount}</p>
      </div>

      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'flat',
            variables: {
              colorPrimary: '#C5A059',
              colorBackground: '#FDFCFB',
              colorText: '#1A1A1A',
              fontFamily: 'Inter, system-ui, sans-serif',
              borderRadius: '0px',
            },
          },
        }}
      >
        <PaymentFormComponent
          onSuccess={onSuccess}
          onBack={onBack}
          amount={amount}
        />
      </Elements>
    </div>
  );
};
