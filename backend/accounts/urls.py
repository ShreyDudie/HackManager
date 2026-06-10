from django.urls import path
from .views import SignupView, LoginView, SharedStateSyncView
from .media_views import PDFUploadView

urlpatterns = [
    path("signup/", SignupView.as_view()),
    path("login/", LoginView.as_view()),
    path("pdf-upload/", PDFUploadView.as_view()),
    path("sync/", SharedStateSyncView.as_view()),
]