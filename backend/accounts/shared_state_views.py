from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SharedState


@method_decorator(csrf_exempt, name="dispatch")
class SharedStateSyncView(APIView):
    def get(self, request):
        states = SharedState.objects.all()
        return Response({state.key: state.value for state in states}, status=status.HTTP_200_OK)

    def post(self, request):
        for key, value in request.data.items():
            if value is None:
                SharedState.objects.filter(key=key).delete()
            else:
                SharedState.objects.update_or_create(key=key, defaults={"value": str(value)})
        return Response({"status": "success"}, status=status.HTTP_200_OK)
