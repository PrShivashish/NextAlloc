import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Upload, CheckCircle, XCircle, Loader2, Phone, Shield, ArrowRight } from 'lucide-react';

// --- Reusable UI Components ---
const Button = React.forwardRef(({ className = '', variant = 'default', children, ...props }: any, ref: any) => {
  let baseClasses =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 shadow-md";
  let variantClasses: any = {
    default: "bg-indigo-600 text-white hover:bg-indigo-700",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    success: "bg-green-600 text-white hover:bg-green-700",
  };
  return (
    <button
      ref={ref}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

const Input = React.forwardRef(({ className = '', type = 'text', ...props }: any, ref: any) => {
  return (
    <input
      ref={ref}
      type={type}
      className={`flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm ${className}`}
      {...props}
    />
  );
});

// --- Mock Aadhaar Database with Twilio verified phone numbers ---
const AADHAAR_DATA = [
  { id: '111122223333', name: 'Aarav Sharma', dob: '2001-05-15', registered: 'Yes', phone: '+917003365991' },
  { id: '111122223334', name: 'Diya Patel', dob: '2002-08-20', registered: 'Yes', phone: '+919830121021' },
  { id: '111122223335', name: 'Rohan Gupta', dob: '2003-01-10', registered: 'Yes', phone: '+917060571005' },
  { id: '111122223336', name: 'Priya Verma', dob: '1998-11-25', registered: 'Yes', phone: '+919142468747' },
  { id: '111122223337', name: 'Karan Singh', dob: '1995-04-03', registered: 'Yes', phone: '+917003365991' },
  { id: '111122223340', name: 'Sara Khan', dob: '1999-10-10', registered: 'Yes', phone: '+919830121021' },
  { id: '111122223350', name: 'Amit Desai', dob: '1990-01-01', registered: 'Yes', phone: '+917060571005' },
  { id: '111122223354', name: 'Myra Bose', dob: '2001-07-01', registered: 'No', phone: '+919142468747' },
  { id: '111122223360', name: 'Shruti Hegde', dob: '2001-06-12', registered: 'No', phone: '+917003365991' },
  { id: '999988887777', name: 'Nitya Varma', dob: '2003-03-18', registered: 'No', phone: '+919830121021' },
  { id: '123412341234', name: 'Test User', dob: '2000-01-01', registered: 'Yes', phone: '+917003365991' },
];

const FALLBACK_AADHAAR_MAP: Record<string, any> = AADHAAR_DATA.reduce((acc: any, item) => {
  acc[item.id] = item;
  return acc;
}, {});

// --- Mock QR Code Scanner ---
const dynamicMockScanQRCode = (file: File | null, expectedId: string, registryMap: Record<string, any>) =>
  new Promise<{ success: boolean; message: string; data?: any }>((resolve) => {
    setTimeout(() => {
      if (!file) return resolve({ success: false, message: "No file uploaded." });

      const fileName = (file.name || "").toLowerCase();
      const match = fileName.match(/\d{12}/);
      if (!match) return resolve({ success: false, message: "QR code could not be read or is invalid." });

      const scannedId = match[0];
      if (scannedId !== expectedId) {
        return resolve({ success: false, message: `QR (${scannedId}) doesn't match Aadhaar (${expectedId}).` });
      }

      const record = registryMap[scannedId];
      if (!record) {
        return resolve({ success: false, message: `Aadhaar ${scannedId} not in registry.` });
      }

      if (record.registered?.toLowerCase() === 'yes') {
        return resolve({ success: true, message: "QR verified!", data: record });
      } else {
        return resolve({ success: false, message: `Aadhaar not registered for e-KYC.` });
      }
    }, 1200);
  });

type VerificationStep = 'qr_input' | 'qr_verifying' | 'otp_sending' | 'otp_input' | 'otp_verifying' | 'complete';

// --- Main EKycSection Component ---
function EKycSection({ onComplete, onDataUpdate, formData, onNext }: any) {
  const [aadharNumber, setAadharNumber] = useState(formData?.aadharNumber || "");
  const [showAadhar, setShowAadhar] = useState(false);
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<VerificationStep>('qr_input');
  const [status, setStatus] = useState({ message: '', isError: false });
  const [kycData, setKycData] = useState<any>(null);
  const [otp, setOtp] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isValidAadhaarFormat = aadharNumber.length === 12 && /^\d+$/.test(aadharNumber);
  const canProceed = step === 'complete' && consent;

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (step === 'otp_input' && countdown === 0) {
      setCanResend(true);
    }
  }, [countdown, step]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAadharFile(e.target.files[0]);
      setStatus({ message: `File: ${e.target.files[0].name}`, isError: false });
    }
  };

  // Send OTP via API
  const sendOTP = async () => {
    setStep('otp_sending');
    setStatus({ message: 'Sending OTP...', isError: false });

    try {
      console.log('[OTP] Sending to /api/ekyc/send-otp, Aadhaar:', aadharNumber);
      const response = await fetch('/api/ekyc/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaarNumber: aadharNumber }),
      });

      console.log('[OTP] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OTP] Error:', errorText);
        setStep('qr_input');
        setStatus({ message: `Server error (${response.status}). Restart server.`, isError: true });
        return;
      }

      const data = await response.json();
      console.log('[OTP] Response:', data);

      if (data.success) {
        setMaskedPhone(data.maskedPhone || '******');
        setStep('otp_input');
        setCountdown(300);
        setCanResend(false);
        setStatus({ message: `OTP sent to ${data.maskedPhone}`, isError: false });
      } else {
        setStep('qr_input');
        setStatus({ message: data.error || 'Failed to send OTP', isError: true });
      }
    } catch (err: any) {
      console.error('[OTP] Network error:', err);
      setStep('qr_input');
      setStatus({ message: `Network error: ${err.message}`, isError: true });
    }
  };

  // Step 1: Verify QR
  const handleVerifyQR = async () => {
    if (!isValidAadhaarFormat) {
      return setStatus({ message: 'Enter valid 12-digit Aadhaar.', isError: true });
    }
    if (!aadharFile) {
      return setStatus({ message: 'Upload QR code image.', isError: true });
    }

    setStep('qr_verifying');
    setStatus({ message: 'Verifying QR...', isError: false });

    const result = await dynamicMockScanQRCode(aadharFile, aadharNumber, FALLBACK_AADHAAR_MAP);

    if (result.success) {
      setKycData(result.data);
      setStatus({ message: 'QR verified! Sending OTP...', isError: false });
      await sendOTP();
    } else {
      setStep('qr_input');
      setStatus({ message: result.message, isError: true });
    }
  };

  // Step 3: Verify OTP
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      return setStatus({ message: 'Enter 6-digit OTP.', isError: true });
    }

    setStep('otp_verifying');
    setStatus({ message: 'Verifying OTP...', isError: false });

    try {
      const response = await fetch('/api/ekyc/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaarNumber: aadharNumber, otp }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('complete');
        setStatus({ message: 'e-KYC complete!', isError: false });
        onDataUpdate({ aadharNumber, kycData, otpVerified: true });
        if (typeof onComplete === 'function') onComplete(1);
        notifyEkycCompleted({ verified: true, aadhaarNumber: aadharNumber, ...kycData });
      } else {
        setStep('otp_input');
        setStatus({ message: data.error || 'Invalid OTP', isError: true });
      }
    } catch (err: any) {
      setStep('otp_input');
      setStatus({ message: `Network error: ${err.message}`, isError: true });
    }
  };

  const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
        <Shield className="text-indigo-600" size={24} />
        Aadhaar E-KYC Verification
      </h2>

      {/* Progress */}
      <div className="flex items-center justify-between text-sm">
        <div className={`flex items-center gap-2 ${['qr_input', 'qr_verifying'].includes(step) ? 'text-indigo-600 font-medium' : 'text-green-600'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${!['qr_input', 'qr_verifying'].includes(step) ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white'}`}>
            {!['qr_input', 'qr_verifying'].includes(step) ? <CheckCircle size={14} /> : '1'}
          </div>
          QR
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2">
          <div className={`h-full bg-indigo-600 transition-all ${!['qr_input', 'qr_verifying'].includes(step) ? 'w-full' : 'w-0'}`} />
        </div>
        <div className={`flex items-center gap-2 ${['otp_input', 'otp_verifying', 'otp_sending'].includes(step) ? 'text-indigo-600 font-medium' : step === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'complete' ? 'bg-green-600 text-white' : ['otp_input', 'otp_verifying', 'otp_sending'].includes(step) ? 'bg-indigo-600 text-white' : 'bg-gray-300'}`}>
            {step === 'complete' ? <CheckCircle size={14} /> : '2'}
          </div>
          OTP
        </div>
      </div>

      {/* Step 1: QR Input */}
      {['qr_input', 'qr_verifying'].includes(step) && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Aadhaar Number</label>
            <div className="relative">
              <Input
                value={aadharNumber}
                onChange={(e: any) => setAadharNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="12-digit Aadhaar"
                type={showAadhar ? 'text' : 'password'}
                maxLength={12}
                disabled={step === 'qr_verifying'}
              />
              <button type="button" onClick={() => setShowAadhar(!showAadhar)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">
                {showAadhar ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">QR Code Image</label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50" onClick={() => fileInputRef.current?.click()}>
              <Upload size={24} className="mx-auto text-indigo-500 mb-2" />
              <p className="text-sm text-gray-500">{aadharFile ? aadharFile.name : "Click to upload"}</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>

          <Button onClick={handleVerifyQR} disabled={!isValidAadhaarFormat || !aadharFile || step === 'qr_verifying'} className="w-full">
            {step === 'qr_verifying' ? <><Loader2 size={20} className="mr-2 animate-spin" /> Verifying...</> : <>Verify & Send OTP <ArrowRight size={16} className="ml-2" /></>}
          </Button>
        </div>
      )}

      {/* Step 2: OTP Input */}
      {['otp_input', 'otp_verifying', 'otp_sending'].includes(step) && (
        <div className="space-y-4">
          <div className="bg-green-50 p-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="text-green-600" size={18} />
            <span className="text-green-800 font-medium">QR Verified - {kycData?.name}</span>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="text-indigo-600" size={18} />
              <span className="text-indigo-800 font-medium">OTP sent to {maskedPhone}</span>
            </div>
            <Input
              value={otp}
              onChange={(e: any) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit OTP"
              className="text-center text-lg tracking-widest font-mono"
              maxLength={6}
              disabled={step !== 'otp_input'}
            />
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-gray-500">{countdown > 0 ? `Expires: ${formatCountdown(countdown)}` : 'Expired'}</span>
              {canResend && <button onClick={sendOTP} className="text-indigo-600 hover:underline">Resend</button>}
            </div>
          </div>

          <Button onClick={handleVerifyOTP} disabled={otp.length !== 6 || step !== 'otp_input' || countdown === 0} className="w-full" variant="success">
            {step === 'otp_verifying' ? <><Loader2 size={20} className="mr-2 animate-spin" /> Verifying...</> : <>Verify OTP <CheckCircle size={16} className="ml-2" /></>}
          </Button>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
              <CheckCircle className="text-white" size={28} />
            </div>
            <div>
              <p className="font-bold text-green-800 text-lg">e-KYC Complete!</p>
              <p className="text-sm text-green-600">Identity verified</p>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Name:</span><span className="font-medium">{kycData?.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Aadhaar:</span><span className="font-mono">XXXX XXXX {aadharNumber.slice(-4)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Phone:</span><span>{maskedPhone}</span></div>
          </div>
        </div>
      )}

      {/* Status */}
      {status.message && step !== 'complete' && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${status.isError ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
          {status.isError ? <XCircle size={18} /> : <Loader2 size={18} className={step.includes('verifying') || step.includes('sending') ? 'animate-spin' : ''} />}
          {status.message}
        </div>
      )}

      {/* PIA Consent */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Partner Integrating Agency (PIA) Consent</p>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="pia-consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          />
          <label htmlFor="pia-consent" className="text-sm text-gray-700 leading-relaxed">
            I voluntarily provide my Aadhaar number and authorize <strong>AICTE Internship Portal</strong> (via authorized PIA) to:
            <ul className="list-disc ml-5 mt-2 text-xs text-gray-600 space-y-1">
              <li>Access my Aadhaar data from UIDAI for identity verification</li>
              <li>Authenticate using OTP sent to my registered mobile number</li>
              <li>Store masked Aadhaar (last 4 digits only) for record purposes</li>
            </ul>
          </label>
        </div>
        <p className="text-xs text-gray-500 italic">
          This consent is in accordance with <strong>Aadhaar Act, 2016</strong> and UIDAI guidelines for e-KYC authentication.
        </p>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <Button onClick={() => { setAadharFile(null); setOtp(''); setStep('qr_input'); setStatus({ message: '', isError: false }); }} variant="outline" className="flex-1">Reset</Button>
        <Button onClick={() => canProceed && onNext?.()} disabled={!canProceed} variant="success" className="flex-1">Proceed <ArrowRight size={16} className="ml-2" /></Button>
      </div>
    </div>
  );
}

// --- Notify parent ---
export function notifyEkycCompleted(result: any = { verified: true }) {
  try { sessionStorage.setItem("ekyc_result", JSON.stringify(result)); } catch { }
  try { window.dispatchEvent(new CustomEvent("ekyc:completed", { detail: result })); } catch { }
}

(window as any).notifyEkycCompleted = notifyEkycCompleted;

// --- Standalone App ---
const App = () => {
  const [formData, setFormData] = useState<any>({});
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6">
        <h1 className="text-2xl font-bold text-indigo-700 mb-4">e-KYC Demo</h1>
        <EKycSection
          onComplete={() => console.log('Complete!')}
          onDataUpdate={(d: any) => setFormData((p: any) => ({ ...p, ...d }))}
          formData={formData}
          onNext={() => alert('Proceeding!')}
        />
      </div>
    </div>
  );
};

export { EKycSection };
export default App;
