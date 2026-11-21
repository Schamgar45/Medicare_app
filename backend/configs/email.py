import logging

import resend
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger("configs.email")


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
    # Priorité au backend Django dès que SMTP est configuré : une ancienne clé
    # Resend (avec l'expéditeur de test) ne doit pas casser les envois.
    # Sans clé Resend, c'est aussi Django qui envoie (console en DEBUG).
    use_django = (
        settings.TESTING
        or not settings.RESEND_API_KEY
        or settings.SMTP_CONFIGURED
        or (settings.DEBUG and "@resend.dev" in settings.DEFAULT_FROM_EMAIL)
    )
    if use_django:
        return _send_with_django(
            subject, message, recipient_list, html_message, from_email
        )

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
        return resend.Emails.send(params)
    except Exception:
        logger.exception(
            "Resend delivery failed (from=%s, recipients=%d)",
            params["from"],
            len(recipient_list),
        )
        raise
