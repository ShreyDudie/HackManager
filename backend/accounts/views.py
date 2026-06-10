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
# 🔹 SHARED STATE SYNC — Syncs localStorage data across different browsers
# =============================================================================
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import SharedState

@method_decorator(csrf_exempt, name='dispatch')
class SharedStateSyncView(APIView):
    def get(self, request):
        states = SharedState.objects.all()
        data = {s.key: s.value for s in states}
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        for k, v in data.items():
            if v is None:
                SharedState.objects.filter(key=k).delete()
            else:
                SharedState.objects.update_or_create(key=k, defaults={"value": str(v)})
        return Response({"status": "success"}, status=status.HTTP_200_OK)