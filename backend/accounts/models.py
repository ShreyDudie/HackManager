from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('judge', 'Judge'),
        ('admin', 'Admin'),
    )

    email = models.EmailField(unique=True)  # ✅ make email unique
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    phone_number = models.CharField(max_length=10, blank=True, null=True, unique=True)  # Fix 1

    USERNAME_FIELD = 'email'                # ✅ login with email
    REQUIRED_FIELDS = ['username']          # still need username for admin

    def __str__(self):
        return self.email