import os
import logging
import resend

logger = logging.getLogger("carid.email")

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_DOMAIN = os.getenv("RESEND_DOMAIN", "carid.org")
FROM_EMAIL = f"verify@{RESEND_DOMAIN}"

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def send_verification_email(to_email: str, code: str) -> bool:
    """Send a 6-digit verification code via Resend."""
    if not RESEND_API_KEY:
        logger.error("RESEND_API_KEY not configured — cannot send verification email")
        return False

    try:
        resend.Emails.send({
            "from": f"CarId <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": "Verify your CarId account",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="text-align: center; color: #2196f3;">🚗 CarId</h2>
                <p>Enter this code in the app to verify your email address:</p>
                <div style="text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">
                        {code}
                    </span>
                </div>
                <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
                <p style="color: #666; font-size: 14px;">If you didn't create a CarId account, you can safely ignore this email.</p>
            </div>
            """,
        })
        logger.info("Verification email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send verification email to %s: %s", to_email, e)
        return False


def send_password_reset_email(to_email: str, code: str) -> bool:
    """Send a 6-digit password reset code via Resend."""
    if not RESEND_API_KEY:
        logger.error("RESEND_API_KEY not configured — cannot send password reset email")
        return False

    try:
        resend.Emails.send({
            "from": f"CarId <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": "Reset your CarId password",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="text-align: center; color: #2196f3;">🚗 CarId</h2>
                <p>You requested a password reset. Enter this code in the app:</p>
                <div style="text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">
                        {code}
                    </span>
                </div>
                <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
                <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
            """,
        })
        logger.info("Password reset email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send password reset email to %s: %s", to_email, e)
        return False
