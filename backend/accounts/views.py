from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import SignupSerializer, LoginSerializer

# =============================================================================
# 🔹 SIGNUP — Creates a new user (student / judge / admin)
# =============================================================================
class SignupView(APIView):
    def post(self, request):
        serializer = SignupSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "User created successfully"},
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# 🔹 LOGIN — Returns JWT tokens + user info
# =============================================================================
class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.validated_data["user"]
            refresh = RefreshToken.for_user(user)

            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "role": user.role,
                "email": user.email,
                "username": user.username,
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# NOTE: The following views were removed because they referenced a Submission
# model and SubmissionSerializer that did not exist in models.py / serializers.py.
# Submission logic is now handled entirely on the frontend via localStorage.
#
# Removed views:
#   - AllSubmissionsView
#   - MySubmissionsView
#   - JudgeSubmissionsView
#   - DashboardDataView
#   - UpdateSubmissionStatusView
# =============================================================================