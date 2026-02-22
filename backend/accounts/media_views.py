import os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.core.files.storage import FileSystemStorage

class PDFUploadView(APIView):
    def post(self, request):
        if 'file' not in request.FILES:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
        
        pdf_file = request.FILES['file']
        
        # Validation
        if not pdf_file.name.endswith('.pdf'):
            return Response({"error": "Only PDF files are allowed"}, status=status.HTTP_400_BAD_REQUEST)
        
        if pdf_file.size > 10 * 1024 * 1024:  # 10MB
            return Response({"error": "File size exceeds 10MB limit"}, status=status.HTTP_400_BAD_REQUEST)

        # Storage
        fs = FileSystemStorage()
        filename = fs.save(f"pdfs/{pdf_file.name}", pdf_file)
        file_url = fs.url(filename)
        
        # Absolute URL for frontend
        full_url = request.build_absolute_uri(file_url)
        
        return Response({
            "url": full_url,
            "filename": filename
        }, status=status.HTTP_201_CREATED)
