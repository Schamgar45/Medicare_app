import resend
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMultiAlternatives


def send_email(subject, message, recipient_list, html_message=None, from_email=None):
    if settings.TESTING:
        email = EmailMultiAlternatives(
            subject=subject,
            body=message,
            from_email=from_email or settings.DEFAULT_FROM_EMAIL,
            to=recipient_list,
        )
        if html_message is not None:
            email.attach_alternative(html_message, "text/html")
        return email.send()

    # Resend reste le transport réel dès qu'une clé est configurée, y compris
    # pendant le développement. Sans clé, DEBUG utilise le backend console.
    if not settings.RESEND_API_KEY:
        if settings.DEBUG:
            email = EmailMultiAlternatives(
                subject=subject,
                body=message,
                from_email=from_email or settings.DEFAULT_FROM_EMAIL,
                to=recipient_list,
            )
            if html_message is not None:
                email.attach_alternative(html_message, "text/html")
            return email.send()
        raise ImproperlyConfigured("RESEND_API_KEY must be set to send email.")

    resend.api_key = settings.RESEND_API_KEY
    params = {
        "from": from_email or settings.DEFAULT_FROM_EMAIL,
        "to": recipient_list,
        "subject": subject,
        "text": message,
    }
    if html_message is not None:
        params["html"] = html_message

    return resend.Emails.send(params)
