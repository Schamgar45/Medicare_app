import logging

import resend
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger("configs.email")


def email_transport():
    """Transport réellement utilisé, sans exposer de secret (utile pour /health)."""
    if settings.TESTING:
        return "test"
    if (
        settings.RESEND_API_KEY
        and not settings.SMTP_CONFIGURED
        and not (settings.DEBUG and "@resend.dev" in settings.DEFAULT_FROM_EMAIL)
    ):
        return "resend"
    # Hors Resend, c'est le backend Django qui décide réellement (smtp/console).
    backend = settings.EMAIL_BACKEND
    if "smtp" in backend:
        return "smtp"
    if "console" in backend:
        return "console"
    if "locmem" in backend:
        return "locmem"
    return "django"


def _send_with_django(subject, message, recipient_list, html_message, from_email):
    """Envoi via le backend Django configuré (SMTP en production, console en DEBUG)."""
    email = EmailMultiAlternatives(
        subject=subject,
        body=message,
        from_email=from_email or settings.DEFAULT_FROM_EMAIL,
        to=recipient_list,
    )
    if html_message is not None:
        email.attach_alternative(html_message, "text/html")
    return email.send()


def send_email(subject, message, recipient_list, html_message=None, from_email=None):
    transport = email_transport()

    # Priorité au backend Django dès que SMTP est configuré : une ancienne clé
    # Resend (avec l'expéditeur de test) ne doit pas casser les envois.
    if transport != "resend":
        try:
            sent = _send_with_django(
                subject, message, recipient_list, html_message, from_email
            )
        except Exception:
            logger.exception(
                "Email delivery failed (transport=%s, recipients=%d)",
                transport,
                len(recipient_list),
            )
            raise
        logger.info(
            "Email sent (transport=%s, backend=%s, recipients=%d)",
            transport,
            settings.EMAIL_BACKEND.rsplit(".", 1)[-1],
            len(recipient_list),
        )
        return sent

    resend.api_key = settings.RESEND_API_KEY
    params = {
        "from": from_email or settings.DEFAULT_FROM_EMAIL,
        "to": recipient_list,
        "subject": subject,
        "text": message,
    }
    if html_message is not None:
        params["html"] = html_message

    try:
        result = resend.Emails.send(params)
    except Exception:
        logger.exception(
            "Resend delivery failed (from=%s, recipients=%d)",
            params["from"],
            len(recipient_list),
        )
        raise
    logger.info("Email sent (transport=resend, recipients=%d)", len(recipient_list))
    return result
