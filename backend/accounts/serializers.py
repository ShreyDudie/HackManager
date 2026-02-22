from rest_framework import serializers
from .models import User
from django.contrib.auth import authenticate
import re


class SignupSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'role', 'phone_number']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def validate_email(self, value):
        """Fix 1: Proper email format validation"""
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, value):
            raise serializers.ValidationError("Invalid email format")
        return value.strip().lower()

    def validate_password(self, value):
        """Fix 1: Strong password validation"""
        if len(value) < 6:
            raise serializers.ValidationError("Password must be at least 6 characters")
        return value

    def validate_phone_number(self, value):
        """Fix 1: Phone number validation — exactly 10 digits"""
        if not value or not value.strip():
            return None  # Optional field
        cleaned = value.strip()
        if not re.match(r'^\d{10}$', cleaned):
            raise serializers.ValidationError("Phone number must be exactly 10 digits")
        # Uniqueness check
        if User.objects.filter(phone_number=cleaned).exists():
            raise serializers.ValidationError("This phone number is already registered")
        return cleaned

    def validate_username(self, value):
        """Fix 1: Trim whitespace, prevent blank"""
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Name cannot be blank")
        return cleaned

    def create(self, validated_data):
        phone = validated_data.pop('phone_number', None)
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data['role']
        )
        if phone:
            user.phone_number = phone
            user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    role = serializers.CharField()

    def validate(self, data):
        user = authenticate(email=data['email'], password=data['password'])

        if not user:
            raise serializers.ValidationError("Invalid credentials")

        if user.role != data['role']:
            raise serializers.ValidationError("Role mismatch")

        data['user'] = user
        return data