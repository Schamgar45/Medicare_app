from rest_framework import serializers
from users.brief import ServiceBriefSerializer

from .models import Doctor


class DoctorSerializer(serializers.ModelSerializer):

    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    specialty_name = serializers.CharField(
        source="specialty.name", read_only=True, default=None
    )
    service_detail = ServiceBriefSerializer(source="service", read_only=True)

    def get_name(self, obj) -> str | None:
        return obj.user.get_full_name() or obj.user.username

    class Meta:
        model = Doctor
        fields = [
            "id",
            "user",
            "name",
            "email",
            "phone",
            "specialty",
            "specialty_name",
            "registration_number",
            "service",
            "service_detail",
            "consultation_fee",
            "is_available",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]
