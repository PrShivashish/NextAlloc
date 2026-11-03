import { useRef, useState, useCallback } from "react";
import ReCAPTCHA from "react-google-recaptcha";

// reCAPTCHA site key from environment variable
// Note: Must register 127.0.0.1 and localhost in Google reCAPTCHA console for local testing
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LdlziUsAAAAAObaJDHhvJYeNSPffq-GrZNZY3ia";

interface UseRecaptchaOptions {
    /** Custom site key (optional, uses test key by default) */
    siteKey?: string;
    /** Theme for the widget */
    theme?: "light" | "dark";
    /** Size of the widget */
    size?: "normal" | "compact";
}

interface UseRecaptchaReturn {
    /** The current captcha token (null if not verified) */
    token: string | null;
    /** Ref to attach to the ReCAPTCHA component */
    recaptchaRef: React.RefObject<ReCAPTCHA>;
    /** Handler for when captcha is completed */
    onCaptchaChange: (token: string | null) => void;
    /** Reset the captcha (call after failed submission) */
    resetCaptcha: () => void;
    /** Validate that captcha is completed, returns error message or null */
    validateCaptcha: () => string | null;
    /** Check if captcha is valid (boolean version) */
    isValid: boolean;
    /** Site key being used */
    siteKey: string;
    /** Props to spread on ReCAPTCHA component */
    recaptchaProps: {
        ref: React.RefObject<ReCAPTCHA>;
        sitekey: string;
        onChange: (token: string | null) => void;
        onExpired: () => void;
        onErrored: () => void;
        theme?: "light" | "dark";
        size?: "normal" | "compact";
    };
}

/**
 * Custom hook for Google reCAPTCHA v2 integration
 * 
 * @example
 * ```tsx
 * const { token, validateCaptcha, resetCaptcha, recaptchaProps } = useRecaptcha();
 * 
 * const handleSubmit = async () => {
 *   const error = validateCaptcha();
 *   if (error) {
 *     setError(error);
 *     return;
 *   }
 *   try {
 *     await loginStudent(email, password, token!);
 *   } catch (err) {
 *     resetCaptcha(); // Reset on error
 *   }
 * };
 * 
 * // In JSX:
 * <ReCAPTCHA {...recaptchaProps} />
 * ```
 */
export function useRecaptcha(options: UseRecaptchaOptions = {}): UseRecaptchaReturn {
    const {
        siteKey = RECAPTCHA_SITE_KEY,
        theme = "light",
        size = "normal"
    } = options;

    const [token, setToken] = useState<string | null>(null);
    const recaptchaRef = useRef<ReCAPTCHA>(null);

    const onCaptchaChange = useCallback((newToken: string | null) => {
        setToken(newToken);
    }, []);

    const resetCaptcha = useCallback(() => {
        recaptchaRef.current?.reset();
        setToken(null);
    }, []);

    const validateCaptcha = useCallback((): string | null => {
        if (!token || token.length === 0) {
            return "Please complete the CAPTCHA verification.";
        }
        return null;
    }, [token]);

    const isValid = token !== null && token.length > 0;

    const recaptchaProps = {
        ref: recaptchaRef,
        sitekey: siteKey,
        onChange: onCaptchaChange,
        onExpired: () => setToken(null),
        onErrored: () => setToken(null),
        theme,
        size,
    };

    return {
        token,
        recaptchaRef,
        onCaptchaChange,
        resetCaptcha,
        validateCaptcha,
        isValid,
        siteKey,
        recaptchaProps,
    };
}
