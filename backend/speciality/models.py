from django.db import models


class Specialty(models.Model):

    name = models.CharField(max_length=150, unique=True)

    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
