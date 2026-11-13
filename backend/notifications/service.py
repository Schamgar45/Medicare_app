from django.conf import settings
from django.template.loader import render_to_string

from configs.email import send_email
from .models import Notification, NotificationPreference


def get_user_preference(user):
    """Récupère (ou crée) les préférences de notification d'un utilisateur."""
    pref, _ = NotificationPreference.objects.get_or_create(user=user)
    return pref


def should_send(pref, notif_type):
    """Vérifie si une notification de ce type est activée pour l'utilisateur."""
    mapping = {
        Notification.Type.LAB_RESULT: pref.lab_result,
        Notification.Type.LOW_STOCK: pref.low_stock,
        Notification.Type.APPOINTMENT: pref.appointment,
        Notification.Type.PAYMENT: pref.payment,
        Notification.Type.INVOICE: pref.invoice,
        Notification.Type.SYSTEM: pref.system,
    }
    return mapping.get(notif_type, True)


def send_notification(user, title, message, notif_type=Notification.Type.SYSTEM,
                      channels=None, email=None, phone=None):
    """
    Crée une notification en base et l'envoie sur les canaux demandés.

    channels : liste de Notification.Channel (ex: [IN_APP, EMAIL])
               Si None, on utilise les préférences de l'utilisateur.
    """
    pref = get_user_preference(user)
    channels = channels or [Notification.Channel.IN_APP]

    created = []
    for channel in channels:
        # Respecte les préférences par type
        if channel == Notification.Channel.EMAIL and not pref.email_enabled:
            continue
        if channel == Notification.Channel.SMS and not pref.sms_enabled:
            continue
        if not should_send(pref, notif_type):
            continue

        notif = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            type=notif_type,
            channel=channel,
        )

        if channel == Notification.Channel.EMAIL:
            _send_email(user, title, message, email or pref.email_address)
            notif.sent_email = True
            notif.save(update_fields=["sent_email"])

        if channel == Notification.Channel.SMS:
            _send_sms(user, message, phone or pref.phone_number)
            notif.sent_sms = True
            notif.save(update_fields=["sent_sms"])

        notif.sent_at = __import__("django.utils.timezone", fromlist=["now"]).now()
        notif.save(update_fields=["sent_at"])
        created.append(notif)

    return created


def _send_email(user, title, message, to_email):
    if not to_email:
        return
    send_email(
        subject=f"[Medicare] {title}",
        message=message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[to_email],
    )


def _send_sms(user, message, phone):
    """Placeholder pour l'envoi SMS (à brancher sur un provider réel)."""
    # Intégration Twilio / Africa's Talking / etc. à brancher ici.
    pass
