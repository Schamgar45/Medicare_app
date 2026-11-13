import resend
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def send_email(subject, message, recipient_list, html_message=None, from_email=None):
    if not settings.RESEND_API_KEY:
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
