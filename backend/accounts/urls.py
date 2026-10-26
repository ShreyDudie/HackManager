from django.urls import path
from .auth_views import LoginView, SignupView
from .media_views import PDFUploadView
from .shared_state_views import SharedStateSyncView

urlpatterns = [
    path("signup/", SignupView.as_view()),
    path("login/", LoginView.as_view()),
    path("pdf-upload/", PDFUploadView.as_view()),
    path("sync/", SharedStateSyncView.as_view()),
]
